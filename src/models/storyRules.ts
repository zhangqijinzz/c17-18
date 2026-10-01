import type { StoryCharacter, StoryClue, StoryDocument, StoryScene, StoryStats } from './story';

export function orderedScenes(story: StoryDocument): StoryScene[] {
  return [...story.scenes].sort((a, b) => a.order - b.order);
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

export interface CharacterDeletionImpact {
  character: StoryCharacter;
  sceneTitles: string[];
}

export interface SceneDeletionImpact {
  scene: StoryScene;
  affectedClueTitles: string[];
  isSelected: boolean;
  fallbackSceneTitle: string | null;
}

export interface ClueDeletionImpact {
  clue: StoryClue;
  sceneTitles: string[];
}

export function getCharacterDeletionImpact(story: StoryDocument, characterId: string): CharacterDeletionImpact | null {
  const character = story.characters.find((item) => item.id === characterId);
  if (!character) return null;
  const sceneTitles = orderedScenes(story)
    .filter((scene) => scene.characterIds.includes(characterId))
    .map((scene) => scene.title);
  return { character, sceneTitles };
}

export function getSceneDeletionImpact(story: StoryDocument, sceneId: string): SceneDeletionImpact | null {
  const scenes = orderedScenes(story);
  const index = scenes.findIndex((scene) => scene.id === sceneId);
  if (index < 0) return null;
  const fallback = scenes[index + 1] ?? scenes[index - 1] ?? null;
  return {
    scene: scenes[index],
    affectedClueTitles: story.clues
      .filter((clue) => clue.setupSceneId === sceneId || clue.payoffSceneId === sceneId)
      .map((clue) => clue.title),
    isSelected: story.selectedSceneId === sceneId,
    fallbackSceneTitle: fallback?.title ?? null,
  };
}

export function getClueDeletionImpact(story: StoryDocument, clueId: string): ClueDeletionImpact | null {
  const clue = story.clues.find((item) => item.id === clueId);
  if (!clue) return null;
  const sceneTitles = orderedScenes(story)
    .filter((scene) => scene.clueIds.includes(clueId))
    .map((scene) => scene.title);
  return { clue, sceneTitles };
}

export function removeCharacter(story: StoryDocument, characterId: string): StoryDocument {
  return {
    ...story,
    characters: story.characters.filter((character) => character.id !== characterId),
    scenes: story.scenes.map((scene) =>
      scene.characterIds.includes(characterId)
        ? { ...scene, characterIds: scene.characterIds.filter((id) => id !== characterId) }
        : scene,
    ),
  };
}

export function removeScene(story: StoryDocument, sceneId: string): StoryDocument {
  const scenes = orderedScenes(story);
  const index = scenes.findIndex((scene) => scene.id === sceneId);
  if (index < 0) return story;
  const fallback = scenes[index + 1] ?? scenes[index - 1] ?? null;
  return {
    ...story,
    scenes: scenes
      .filter((scene) => scene.id !== sceneId)
      .map((scene, sceneIndex) => ({ ...scene, order: sceneIndex + 1 })),
    clues: story.clues.map((clue) => ({
      ...clue,
      setupSceneId: clue.setupSceneId === sceneId ? '' : clue.setupSceneId,
      payoffSceneId: clue.payoffSceneId === sceneId ? '' : clue.payoffSceneId,
    })),
    selectedSceneId: story.selectedSceneId === sceneId ? fallback?.id ?? '' : story.selectedSceneId,
  };
}

export function removeClue(story: StoryDocument, clueId: string): StoryDocument {
  return {
    ...story,
    clues: story.clues.filter((clue) => clue.id !== clueId),
    scenes: story.scenes.map((scene) =>
      scene.clueIds.includes(clueId)
        ? { ...scene, clueIds: scene.clueIds.filter((id) => id !== clueId) }
        : scene,
    ),
  };
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
