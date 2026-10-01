import type { StoryClue, StoryDocument, StoryScene, StoryStats } from './story';

export function orderedScenes(story: StoryDocument): StoryScene[] {
  return [...story.scenes].sort((a, b) => a.order - b.order);
}

export type DeleteTarget = 'character' | 'scene' | 'clue';

export interface DeleteImpact {
  target: DeleteTarget;
  id: string;
  name: string;
  appearanceScenes: StoryScene[];
  setupClues: StoryClue[];
  payoffClues: StoryClue[];
  markedScenes: StoryScene[];
  neighborScene: StoryScene | null;
}

export function getDeleteImpact(story: StoryDocument, target: DeleteTarget, id: string): DeleteImpact | null {
  const scenes = orderedScenes(story);
  if (target === 'character') {
    const character = story.characters.find((item) => item.id === id);
    if (!character) return null;
    return {
      target, id, name: character.name,
      appearanceScenes: scenes.filter((scene) => scene.characterIds.includes(id)),
      setupClues: [], payoffClues: [], markedScenes: [],
      neighborScene: null,
    };
  }
  if (target === 'scene') {
    const index = scenes.findIndex((scene) => scene.id === id);
    const scene = scenes[index];
    if (!scene) return null;
    return {
      target, id, name: scene.title,
      appearanceScenes: [],
      setupClues: story.clues.filter((clue) => clue.setupSceneId === id),
      payoffClues: story.clues.filter((clue) => clue.payoffSceneId === id),
      markedScenes: [],
      neighborScene: scenes[index + 1] ?? scenes[index - 1] ?? null,
    };
  }
  const clue = story.clues.find((item) => item.id === id);
  if (!clue) return null;
  return {
    target, id, name: clue.title,
    appearanceScenes: [], setupClues: [], payoffClues: [],
    markedScenes: scenes.filter((scene) => scene.clueIds.includes(id)),
    neighborScene: null,
  };
}

/** 删除人物：移除每一幕对该人物的引用，不留下空引用。 */
export function deleteCharacter(story: StoryDocument, characterId: string): StoryDocument {
  return {
    ...story,
    characters: story.characters.filter((character) => character.id !== characterId),
    scenes: story.scenes.map((scene) => scene.characterIds.includes(characterId)
      ? { ...scene, characterIds: scene.characterIds.filter((id) => id !== characterId) }
      : scene),
  };
}

/** 删除伏笔：清掉所有场景上挂着的该伏笔标记。 */
export function deleteClue(story: StoryDocument, clueId: string): StoryDocument {
  return {
    ...story,
    clues: story.clues.filter((clue) => clue.id !== clueId),
    scenes: story.scenes.map((scene) => scene.clueIds.includes(clueId)
      ? { ...scene, clueIds: scene.clueIds.filter((id) => id !== clueId) }
      : scene),
  };
}

/**
 * 删除场景：以该幕为埋下/回收位置的伏笔转为待处理（清空对应指向），
 * 场景上的伏笔标记随之清掉，其余幕重新编号；
 * 返回的 selectedSceneId 指向相邻一幕（优先下一幕，末幕取上一幕），无幕可落则为空。
 */
export function deleteScene(story: StoryDocument, sceneId: string): StoryDocument {
  const ordered = orderedScenes(story);
  const index = ordered.findIndex((scene) => scene.id === sceneId);
  if (index < 0) return story;
  const remaining = ordered.filter((scene) => scene.id !== sceneId).map((scene, sceneIndex) => ({ ...scene, order: sceneIndex + 1 }));
  const remainingIds = new Set(remaining.map((scene) => scene.id));
  const scenes = remaining.map((scene) => ({
    ...scene,
    clueIds: scene.clueIds.filter((id) => story.clues.some((clue) => clue.id === id)),
  }));
  const clues = story.clues.map((clue) => {
    const setupGone = clue.setupSceneId === sceneId || (clue.setupSceneId !== '' && !remainingIds.has(clue.setupSceneId));
    const payoffGone = clue.payoffSceneId === sceneId || (clue.payoffSceneId !== '' && !remainingIds.has(clue.payoffSceneId));
    return setupGone || payoffGone
      ? {
          ...clue,
          setupSceneId: setupGone ? '' : clue.setupSceneId,
          payoffSceneId: payoffGone ? '' : clue.payoffSceneId,
        }
      : clue;
  });
  const nextScene = remaining[index] ?? remaining[index - 1] ?? null;
  return { ...story, scenes, clues, selectedSceneId: nextScene?.id ?? '' };
}

/**
 * 规范化老项目：清理悬空引用，使其与删除后的一致性规则相同——
 * 场景只保留仍存在的人物/伏笔；伏笔指向不存在的场景时转为待处理；
 * 选中的场景已不存在时落到相邻一幕。
 */
export function normalizeStory(story: StoryDocument): StoryDocument {
  const characterIds = new Set(story.characters.map((character) => character.id));
  const clueIds = new Set(story.clues.map((clue) => clue.id));
  const ordered = orderedScenes(story);
  const sceneIds = new Set(ordered.map((scene) => scene.id));
  const scenes = ordered.map((scene, index) => ({
    ...scene,
    order: index + 1,
    characterIds: scene.characterIds.filter((id) => characterIds.has(id)),
    clueIds: scene.clueIds.filter((id) => clueIds.has(id)),
  }));
  const clues = story.clues.map((clue) => ({
    ...clue,
    setupSceneId: sceneIds.has(clue.setupSceneId) ? clue.setupSceneId : '',
    payoffSceneId: sceneIds.has(clue.payoffSceneId) ? clue.payoffSceneId : '',
  }));
  const selectedExists = sceneIds.has(story.selectedSceneId);
  const selectedSceneId = selectedExists ? story.selectedSceneId : scenes[0]?.id ?? '';
  return { ...story, scenes, clues, selectedSceneId };
}

export function getStats(story: StoryDocument): StoryStats {
  const unresolvedClues = story.clues.filter((clue) => clue.payoffSceneId === '').length;
  const totalSignals = story.characters.length + story.scenes.length + story.clues.length;
  const completedSignals = story.characters.length + story.scenes.length + (story.clues.length - unresolvedClues);
  const completion = totalSignals === 0 ? 0 : Math.round((completedSignals / totalSignals) * 100);
  return {
    characters: story.characters.length,
    scenes: story.scenes.length,
    clues: story.clues.length,
    unresolvedClues,
    completion,
  };
}

export function validateName(value: string): string {
  const cleanValue = value.trim();
  return cleanValue.length < 2 ? '至少输入 2 个字' : cleanValue;
}

export function getTimelineWarning(story: StoryDocument): string | null {
  const orders = story.scenes.map((scene) => scene.order);
  return new Set(orders).size !== orders.length ? '时间线存在重复顺序，请重新排列。' : null;
}

export function sanitizeStory(input: unknown): StoryDocument | null {
  if (!input || typeof input !== 'object') return null;
  const candidate = input as Partial<StoryDocument>;
  if (
    candidate.version !== 1 ||
    typeof candidate.id !== 'string' ||
    typeof candidate.title !== 'string' ||
    !Array.isArray(candidate.characters) ||
    !Array.isArray(candidate.scenes) ||
    !Array.isArray(candidate.clues)
  ) {
    return null;
  }
  return candidate as StoryDocument;
}
