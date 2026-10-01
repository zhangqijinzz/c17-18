import { describe, expect, it } from 'vitest';
import { createStarterStory } from '../models/story';
import { LocalStoryRepository } from '../repositories/storyRepository';
import { MemoryStorageService } from '../services/storageService';
import { StoryViewModel } from '../viewmodels/storyViewModel';

describe('story view model', () => {
  it('initializes, edits, persists, and restores the main flow', () => {
    const repository = new LocalStoryRepository(new MemoryStorageService());
    const viewModel = new StoryViewModel(repository);
    viewModel.initialize();
    expect(viewModel.snapshot.status).toBe('ready');
    viewModel.addCharacter('阿洛', '修复师');
    viewModel.addScene('地下档案室', '他们找到被隐藏的航海日志。');
    const scene = viewModel.selectedScene;
    expect(scene?.title).toBe('地下档案室');
    viewModel.toggleCharacter(scene?.id ?? '', viewModel.snapshot.story?.characters[2]?.id ?? '');
    expect(viewModel.snapshot.stats.characters).toBe(3);

    const restored = new StoryViewModel(repository);
    restored.initialize();
    expect(restored.snapshot.story?.scenes.some((item) => item.title === '地下档案室')).toBe(true);
    expect(restored.snapshot.story?.characters.some((item) => item.name === '阿洛')).toBe(true);
  });

  it('shows recoverable validation feedback and resets corrupt storage', () => {
    const storage = new MemoryStorageService();
    storage.write('{broken');
    const viewModel = new StoryViewModel(new LocalStoryRepository(storage));
    viewModel.initialize();
    viewModel.addCharacter(' ', '');
    expect(viewModel.snapshot.notice).toContain('至少');
    viewModel.resetProject();
    expect(viewModel.snapshot.story?.id).toBe(createStarterStory().id);
  });

  it('previews deletion impact and only commits after confirmation', () => {
    const repository = new LocalStoryRepository(new MemoryStorageService());
    const viewModel = new StoryViewModel(repository);
    viewModel.initialize();
    viewModel.requestDelete('character', 'character-mira');
    expect(viewModel.snapshot.pendingDelete?.name).toBe('米拉');
    expect(viewModel.snapshot.pendingDelete?.appearanceScenes).toHaveLength(2);
    viewModel.cancelDelete();
    expect(viewModel.snapshot.pendingDelete).toBeNull();
    expect(viewModel.snapshot.story?.characters).toHaveLength(2);

    viewModel.requestDelete('scene', 'scene-old-harbor');
    viewModel.confirmDelete();
    const story = viewModel.snapshot.story;
    expect(story?.scenes.map((scene) => scene.id)).toEqual(['scene-storm']);
    expect(story?.selectedSceneId).toBe('scene-storm');
    expect(story?.clues[0].setupSceneId).toBe('');
    expect(story?.scenes[0].clueIds).toEqual([]);
    expect(viewModel.snapshot.pendingDelete).toBeNull();

    const restored = new StoryViewModel(repository);
    restored.initialize();
    expect(restored.snapshot.story?.scenes).toHaveLength(1);
  });

  it('repairs dangling references when loading an old project', () => {
    const storage = new MemoryStorageService();
    const legacy = createStarterStory();
    legacy.scenes[0].characterIds.push('character-ghost');
    legacy.clues[0].setupSceneId = 'scene-ghost';
    storage.write(JSON.stringify(legacy));
    const viewModel = new StoryViewModel(new LocalStoryRepository(storage));
    viewModel.initialize();
    const harbor = viewModel.snapshot.story?.scenes.find((scene) => scene.id === 'scene-old-harbor');
    expect(harbor?.characterIds).not.toContain('character-ghost');
    expect(viewModel.snapshot.story?.clues[0].setupSceneId).toBe('');
  });
});
