import { createStarterStory, type StoryDocument } from '../models/story';
import { normalizeStory, sanitizeStory } from '../models/storyRules';
import type { StorageService } from '../services/storageService';

export interface StoryRepository {
  load(): StoryDocument;
  save(story: StoryDocument): void;
}

export class LocalStoryRepository implements StoryRepository {
  constructor(private readonly storage: StorageService) {}

  load(): StoryDocument {
    const raw = this.storage.read();
    if (!raw) return createStarterStory();
    try {
      const story = sanitizeStory(JSON.parse(raw));
      return story ? normalizeStory(story) : createStarterStory();
    } catch {
      return createStarterStory();
    }
  }

  save(story: StoryDocument): void {
    this.storage.write(JSON.stringify(story));
  }
}
