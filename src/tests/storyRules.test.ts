import { describe, expect, it } from 'vitest';
import { createStarterStory, type StoryDocument } from '../models/story';
import {
  deleteCharacter,
  deleteClue,
  deleteScene,
  getDeleteImpact,
  getStats,
  getTimelineWarning,
  normalizeStory,
  orderedScenes,
  sanitizeStory,
  validateName,
} from '../models/storyRules';

describe('story domain rules', () => {
  it('sorts scenes and calculates unresolved clues', () => {
    const story = createStarterStory();
    story.scenes = [...story.scenes].reverse();
    expect(orderedScenes(story).map((scene) => scene.title)).toEqual(['旧港口的来信', '风暴前夜']);
    expect(getStats(story)).toMatchObject({ characters: 2, scenes: 2, clues: 1, unresolvedClues: 1, completion: 80 });
  });

  it('guards invalid names and duplicate timeline orders', () => {
    const story = createStarterStory();
    story.scenes[1].order = story.scenes[0].order;
    expect(validateName(' ')).toBe('至少输入 2 个字');
    expect(getTimelineWarning(story)).toContain('重复');
  });

  it('rejects corrupt persisted documents', () => {
    expect(sanitizeStory('{bad json}')).toBeNull();
    expect(sanitizeStory({ version: 99 })).toBeNull();
    expect(sanitizeStory(createStarterStory())).not.toBeNull();
  });
});

describe('delete cascade rules', () => {
  it('removes a character from every scene they appear in, leaving no empty reference', () => {
    const story = createStarterStory();
    const result = deleteCharacter(story, 'character-mira');
    expect(result.characters.map((character) => character.id)).not.toContain('character-mira');
    expect(result.scenes.every((scene) => !scene.characterIds.includes('character-mira'))).toBe(true);
    expect(result.scenes.find((scene) => scene.id === 'scene-storm')?.characterIds).toEqual(['character-june']);
  });

  it('turns clues planted or paid off in the deleted scene into pending and jumps to the next scene', () => {
    const story = createStarterStory();
    const result = deleteScene(story, 'scene-old-harbor');
    const clue = result.clues[0];
    expect(clue.setupSceneId).toBe('');
    expect(clue.payoffSceneId).toBe('');
    expect(result.scenes.map((scene) => scene.id)).toEqual(['scene-storm']);
    expect(result.scenes[0].order).toBe(1);
    expect(result.selectedSceneId).toBe('scene-storm');
  });

  it('falls back to the previous scene when deleting the last selected scene', () => {
    const story = createStarterStory();
    story.selectedSceneId = 'scene-storm';
    const result = deleteScene(story, 'scene-storm');
    expect(result.scenes.map((scene) => scene.id)).toEqual(['scene-old-harbor']);
    expect(result.selectedSceneId).toBe('scene-old-harbor');
  });

  it('clears only the payoff link when only the payoff scene is deleted', () => {
    const story = createStarterStory();
    story.clues[0].payoffSceneId = 'scene-storm';
    const result = deleteScene(story, 'scene-storm');
    expect(result.clues[0].setupSceneId).toBe('scene-old-harbor');
    expect(result.clues[0].payoffSceneId).toBe('');
  });

  it('removes a clue together with its markers on scenes', () => {
    const story = createStarterStory();
    const result = deleteClue(story, 'clue-first-letter');
    expect(result.clues).toHaveLength(0);
    expect(result.scenes.every((scene) => !scene.clueIds.includes('clue-first-letter'))).toBe(true);
  });

  it('previews everything a deletion will affect before it happens', () => {
    const story = createStarterStory();
    const characterImpact = getDeleteImpact(story, 'character', 'character-mira');
    expect(characterImpact?.appearanceScenes.map((scene) => scene.id)).toEqual(['scene-old-harbor', 'scene-storm']);
    const sceneImpact = getDeleteImpact(story, 'scene', 'scene-old-harbor');
    expect(sceneImpact?.setupClues[0]?.id).toBe('clue-first-letter');
    expect(sceneImpact?.neighborScene?.id).toBe('scene-storm');
    const clueImpact = getDeleteImpact(story, 'clue', 'clue-first-letter');
    expect(clueImpact?.markedScenes.map((scene) => scene.id)).toEqual(['scene-old-harbor']);
  });
});

describe('legacy project normalization', () => {
  it('repairs dangling references from old projects with the same rules', () => {
    const legacy = createStarterStory();
    legacy.scenes[0].characterIds.push('character-ghost');
    legacy.scenes[0].clueIds.push('clue-ghost');
    legacy.clues[0].setupSceneId = 'scene-ghost';
    legacy.clues[0].payoffSceneId = 'scene-ghost';
    legacy.selectedSceneId = 'scene-ghost';
    const result = normalizeStory(legacy as StoryDocument);
    const harbor = result.scenes.find((scene) => scene.id === 'scene-old-harbor');
    expect(harbor?.characterIds).not.toContain('character-ghost');
    expect(harbor?.clueIds).not.toContain('clue-ghost');
    expect(result.clues[0].setupSceneId).toBe('');
    expect(result.clues[0].payoffSceneId).toBe('');
    expect(result.selectedSceneId).toBe('scene-old-harbor');
  });

  it('reorders scene numbers after normalization', () => {
    const legacy = createStarterStory();
    legacy.scenes[0].order = 4;
    legacy.scenes[1].order = 9;
    const result = normalizeStory(legacy);
    expect(orderedScenes(result).map((scene) => scene.order)).toEqual([1, 2]);
  });
});
