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

  it('requires confirmation before deleting and cascades cleanup', () => {
    const viewModel = new StoryViewModel(new LocalStoryRepository(new MemoryStorageService()));
    viewModel.initialize();

    viewModel.requestDeletion('character', 'character-mira');
    expect(viewModel.snapshot.pendingDeletion?.title).toBe('人物「米拉」');
    expect(viewModel.snapshot.pendingDeletion?.consequences.join('')).toContain('旧港口的来信');
    viewModel.cancelDeletion();
    expect(viewModel.snapshot.pendingDeletion).toBeNull();
    expect(viewModel.snapshot.story?.characters).toHaveLength(2);

    viewModel.requestDeletion('character', 'character-mira');
    viewModel.confirmDeletion();
    expect(viewModel.snapshot.pendingDeletion).toBeNull();
    expect(viewModel.snapshot.story?.characters).toHaveLength(1);
    expect(viewModel.snapshot.story?.scenes.every((scene) => !scene.characterIds.includes('character-mira'))).toBe(true);

    viewModel.requestDeletion('scene', 'scene-old-harbor');
    expect(viewModel.snapshot.pendingDeletion?.consequences.join('')).toContain('待处理');
    viewModel.confirmDeletion();
    const story = viewModel.snapshot.story;
    expect(story?.scenes.map((scene) => scene.id)).toEqual(['scene-storm']);
    expect(story?.selectedSceneId).toBe('scene-storm');
    expect(story?.clues[0].setupSceneId).toBe('');

    viewModel.requestDeletion('clue', 'clue-first-letter');
    viewModel.confirmDeletion();
    expect(viewModel.snapshot.story?.clues).toHaveLength(0);
    expect(viewModel.snapshot.story?.scenes.every((scene) => scene.clueIds.length === 0)).toBe(true);
  });
});
