import { describe, expect, it } from 'vitest';
import { createStarterStory } from '../models/story';
import {
  getCharacterDeletionImpact,
  getClueDeletionImpact,
  getSceneDeletionImpact,
  getStats,
  getTimelineWarning,
  orderedScenes,
  removeCharacter,
  removeClue,
  removeScene,
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

describe('deletion rules', () => {
  it('describes character impact and clears every scene reference on removal', () => {
    const story = createStarterStory();
    const impact = getCharacterDeletionImpact(story, 'character-mira');
    expect(impact?.sceneTitles).toEqual(['旧港口的来信', '风暴前夜']);
    expect(getCharacterDeletionImpact(story, 'character-nobody')).toBeNull();

    const next = removeCharacter(story, 'character-mira');
    expect(next.characters.map((character) => character.id)).toEqual(['character-june']);
    expect(next.scenes.every((scene) => !scene.characterIds.includes('character-mira'))).toBe(true);
    expect(story.scenes[0].characterIds).toContain('character-mira');
  });

  it('turns linked clues pending, reorders scenes, and moves selection to a neighbor', () => {
    const story = createStarterStory();
    story.clues[0].payoffSceneId = 'scene-storm';
    const impact = getSceneDeletionImpact(story, 'scene-old-harbor');
    expect(impact?.affectedClueTitles).toEqual(['潮汐表背后的日期']);
    expect(impact?.isSelected).toBe(true);
    expect(impact?.fallbackSceneTitle).toBe('风暴前夜');

    const next = removeScene(story, 'scene-old-harbor');
    expect(next.scenes.map((scene) => [scene.id, scene.order])).toEqual([['scene-storm', 1]]);
    expect(next.clues[0].setupSceneId).toBe('');
    expect(next.clues[0].payoffSceneId).toBe('scene-storm');
    expect(next.selectedSceneId).toBe('scene-storm');
  });

  it('clears the payoff reference when the payoff scene is removed', () => {
    const story = createStarterStory();
    story.clues[0].payoffSceneId = 'scene-storm';
    story.selectedSceneId = 'scene-storm';
    const next = removeScene(story, 'scene-storm');
    expect(next.clues[0].payoffSceneId).toBe('');
    expect(next.clues[0].setupSceneId).toBe('scene-old-harbor');
    expect(next.selectedSceneId).toBe('scene-old-harbor');
  });

  it('clears scene markers when a clue is removed', () => {
    const story = createStarterStory();
    const impact = getClueDeletionImpact(story, 'clue-first-letter');
    expect(impact?.sceneTitles).toEqual(['旧港口的来信']);

    const next = removeClue(story, 'clue-first-letter');
    expect(next.clues).toHaveLength(0);
    expect(next.scenes[0].clueIds).toEqual([]);
  });
});
