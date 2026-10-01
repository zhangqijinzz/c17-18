import {
  characterColors,
  createId,
  createStarterStory,
  type StoryCharacter,
  type StoryClue,
  type StoryDocument,
  type StoryScene,
} from '../models/story';
import { getStats, getTimelineWarning, orderedScenes, validateName, deleteCharacter, deleteClue, deleteScene, getDeleteImpact, type DeleteImpact, type DeleteTarget } from '../models/storyRules';
import type { StoryRepository } from '../repositories/storyRepository';

export type ViewModelStatus = 'loading' | 'ready' | 'editing' | 'error' | 'completed';

export interface StoryViewState {
  status: ViewModelStatus;
  story: StoryDocument | null;
  stats: ReturnType<typeof getStats>;
  notice: string;
  error: string;
  search: string;
  activeSection: 'overview' | 'characters' | 'clues';
  pendingDelete: DeleteImpact | null;
}

type Listener = () => void;

export class StoryViewModel {
  private state: StoryViewState = {
    status: 'loading',
    story: null,
    stats: { characters: 0, scenes: 0, clues: 0, unresolvedClues: 0, completion: 0 },
    notice: '',
    error: '',
    search: '',
    activeSection: 'overview',
    pendingDelete: null,
  };
  private readonly listeners = new Set<Listener>();

  constructor(private readonly repository: StoryRepository) {}

  get snapshot(): StoryViewState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  initialize(): void {
    try {
      const story = this.repository.load();
      this.setState({ status: story.status === 'complete' ? 'completed' : 'ready', story, stats: getStats(story), error: '' });
    } catch {
      this.setState({ status: 'error', error: '故事读取失败，请重置为示例项目。' });
    }
  }

  setSearch(search: string): void {
    this.setState({ search });
  }

  setSection(activeSection: StoryViewState['activeSection']): void {
    this.setState({ activeSection });
  }

  selectScene(sceneId: string): void {
    this.updateStory((story) => ({ ...story, selectedSceneId: sceneId }));
  }

  addCharacter(name: string, role: string): void {
    const cleanName = validateName(name);
    if (cleanName === '至少输入 2 个字') {
      this.setState({ notice: cleanName });
      return;
    }
    const story = this.requireStory();
    const character: StoryCharacter = {
      id: createId('character'),
      name: cleanName,
      role: role.trim() || '待定义角色',
      color: characterColors[story.characters.length % characterColors.length],
    };
    this.updateStory((current) => ({ ...current, characters: [...current.characters, character] }));
    this.setState({ notice: `已加入人物「${character.name}」` });
  }

  addScene(title: string, summary: string): void {
    const cleanTitle = validateName(title);
    if (cleanTitle === '至少输入 2 个字') {
      this.setState({ notice: cleanTitle });
      return;
    }
    const story = this.requireStory();
    const scene: StoryScene = {
      id: createId('scene'),
      title: cleanTitle,
      order: story.scenes.length + 1,
      summary: summary.trim() || '还没有写下这一幕发生了什么。',
      conflict: '',
      characterIds: [],
      clueIds: [],
    };
    this.updateStory((current) => ({ ...current, scenes: [...current.scenes, scene], selectedSceneId: scene.id }));
    this.setState({ notice: `已创建场景「${scene.title}」` });
  }

  updateScene(sceneId: string, patch: Partial<Pick<StoryScene, 'title' | 'summary' | 'conflict'>>): void {
    this.updateStory((story) => ({
      ...story,
      scenes: story.scenes.map((scene) => (scene.id === sceneId ? { ...scene, ...patch } : scene)),
    }), false);
  }

  toggleCharacter(sceneId: string, characterId: string): void {
    this.updateStory((story) => ({
      ...story,
      scenes: story.scenes.map((scene) => {
        if (scene.id !== sceneId) return scene;
        const hasCharacter = scene.characterIds.includes(characterId);
        return { ...scene, characterIds: hasCharacter ? scene.characterIds.filter((id) => id !== characterId) : [...scene.characterIds, characterId] };
      }),
    }));
  }

  moveScene(sceneId: string, direction: 'up' | 'down'): void {
    const scenes = orderedScenes(this.requireStory());
    const index = scenes.findIndex((scene) => scene.id === sceneId);
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || nextIndex < 0 || nextIndex >= scenes.length) return;
    [scenes[index], scenes[nextIndex]] = [scenes[nextIndex], scenes[index]];
    this.updateStory((story) => ({ ...story, scenes: scenes.map((scene, sceneIndex) => ({ ...scene, order: sceneIndex + 1 })) }));
    this.setState({ notice: '时间线顺序已更新' });
  }

  /** 删除前先打开确认面板，让作者看清会波及哪些内容。 */
  requestDelete(target: DeleteTarget, id: string): void {
    const impact = getDeleteImpact(this.requireStory(), target, id);
    if (impact) this.setState({ pendingDelete: impact });
  }

  cancelDelete(): void {
    this.setState({ pendingDelete: null });
  }

  confirmDelete(): void {
    const pending = this.state.pendingDelete;
    if (!pending) return;
    if (pending.target === 'character') {
      this.updateStory((story) => deleteCharacter(story, pending.id));
      this.setState({ notice: `已删除人物「${pending.name}」，相关出场记录已一并移除` });
    } else if (pending.target === 'scene') {
      this.updateStory((story) => deleteScene(story, pending.id));
      this.setState({ notice: `已删除场景「${pending.name}」，关联伏笔已转为待处理` });
    } else {
      this.updateStory((story) => deleteClue(story, pending.id));
      this.setState({ notice: `已删除伏笔「${pending.name}」，场景上的标记已清除` });
    }
    this.setState({ pendingDelete: null });
  }

  addClue(title: string, setupSceneId: string, payoffSceneId: string): void {
    const cleanTitle = validateName(title);
    if (cleanTitle === '至少输入 2 个字') {
      this.setState({ notice: cleanTitle });
      return;
    }
    if (!setupSceneId) {
      this.setState({ notice: '请先选择伏笔埋下的场景' });
      return;
    }
    const clue: StoryClue = { id: createId('clue'), title: cleanTitle, setupSceneId, payoffSceneId };
    this.updateStory((story) => ({
      ...story,
      clues: [...story.clues, clue],
      scenes: story.scenes.map((scene) => scene.id === setupSceneId ? { ...scene, clueIds: [...scene.clueIds, clue.id] } : scene),
    }));
    this.setState({ notice: payoffSceneId ? '伏笔关系已建立' : '伏笔已记录，等待回收' });
  }

  completeProject(): void {
    this.updateStory((story) => ({ ...story, status: 'complete' }));
    this.setState({ status: 'completed', notice: '项目已标记为完成，仍可继续编辑' });
  }

  resetProject(): void {
    const story = createStarterStory();
    this.persist(story);
    this.setState({ status: 'ready', story, stats: getStats(story), notice: '已恢复示例项目', error: '', pendingDelete: null });
  }

  get visibleCharacters(): StoryCharacter[] {
    const story = this.requireStory();
    const keyword = this.state.search.trim().toLowerCase();
    return story.characters.filter((character) => `${character.name}${character.role}`.toLowerCase().includes(keyword));
  }

  get visibleScenes(): StoryScene[] {
    const story = this.requireStory();
    const keyword = this.state.search.trim().toLowerCase();
    return orderedScenes(story).filter((scene) => `${scene.title}${scene.summary}${scene.conflict}`.toLowerCase().includes(keyword));
  }

  get selectedScene(): StoryScene | null {
    const story = this.state.story;
    return story?.scenes.find((scene) => scene.id === story.selectedSceneId) ?? null;
  }

  get timelineWarning(): string | null {
    const story = this.state.story;
    return story ? getTimelineWarning(story) : null;
  }

  private requireStory(): StoryDocument {
    if (!this.state.story) throw new Error('故事尚未初始化');
    return this.state.story;
  }

  private updateStory(updater: (story: StoryDocument) => StoryDocument, showEditing = true): void {
    const story = updater(this.requireStory());
    this.persist(story);
    this.setState({ story, stats: getStats(story), status: showEditing ? 'editing' : this.state.status, error: '' });
  }

  private persist(story: StoryDocument): void {
    try {
      this.repository.save({ ...story, updatedAt: new Date().toISOString() });
    } catch {
      this.setState({ status: 'error', error: '保存失败，但当前编辑仍保留在页面中。' });
    }
  }

  private setState(patch: Partial<StoryViewState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }
}
