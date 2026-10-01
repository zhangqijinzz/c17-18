import { useEffect } from 'react';
import type { DeleteImpact } from '../models/storyRules';
import type { StoryViewModel } from '../viewmodels/storyViewModel';

interface DeleteConfirmDialogProps {
  viewModel: StoryViewModel;
  impact: DeleteImpact;
}

const targetLabel: Record<DeleteImpact['target'], string> = {
  character: '人物',
  scene: '场景',
  clue: '伏笔',
};

export function DeleteConfirmDialog({ viewModel, impact }: DeleteConfirmDialogProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') viewModel.cancelDelete();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [viewModel]);

  const clueEffects = new Map<string, { title: string; parts: string[] }>();
  impact.setupClues.forEach((clue) => {
    clueEffects.set(clue.id, { title: clue.title, parts: ['埋下位置'] });
  });
  impact.payoffClues.forEach((clue) => {
    const entry = clueEffects.get(clue.id) ?? { title: clue.title, parts: [] };
    if (!entry.parts.includes('回收位置')) entry.parts.push('回收位置');
    clueEffects.set(clue.id, entry);
  });

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && viewModel.cancelDelete()} role="presentation">
      <div className="modal-card" role="dialog" aria-modal="true" aria-label={`删除${targetLabel[impact.target]}确认`}>
        <span className="eyebrow">DELETE / 删除确认</span>
        <h2>删除{targetLabel[impact.target]}「{impact.name}」</h2>
        <div className="modal-body">
          {impact.target === 'character' && (
            impact.appearanceScenes.length > 0 ? (
              <div className="impact-block"><p>该人物将从以下 <b>{impact.appearanceScenes.length}</b> 幕的出场人物中移除：</p><ul>{impact.appearanceScenes.map((scene) => <li key={scene.id}>{scene.title}</li>)}</ul></div>
            ) : <p className="impact-empty">该人物尚未在任何一幕出场。</p>
          )}
          {impact.target === 'scene' && (
            <>
              {clueEffects.size > 0 ? (
                <div className="impact-block"><p>以下伏笔指向这一幕，删除后将转为<b>待处理</b>，不会指向不存在的场景：</p><ul>{[...clueEffects.values()].map((entry) => <li key={entry.title}>{entry.title}<em>{entry.parts.join(' / ')}</em></li>)}</ul></div>
              ) : <p className="impact-empty">没有伏笔以这一幕为埋下或回收位置。</p>}
              {impact.neighborScene && <p className="impact-hint">删除后将自动跳转到相邻一幕「{impact.neighborScene.title}」。</p>}
            </>
          )}
          {impact.target === 'clue' && (
            impact.markedScenes.length > 0 ? (
              <div className="impact-block"><p>以下 <b>{impact.markedScenes.length}</b> 个场景上的伏笔标记将一并清除：</p><ul>{impact.markedScenes.map((scene) => <li key={scene.id}>{scene.title}</li>)}</ul></div>
            ) : <p className="impact-empty">没有场景挂着这条伏笔标记。</p>
          )}
          <p className="impact-warning">此操作不可撤销，如需找回只能恢复示例项目。</p>
        </div>
        <div className="modal-actions">
          <button className="modal-cancel" onClick={() => viewModel.cancelDelete()}>取消</button>
          <button className="modal-confirm" onClick={() => viewModel.confirmDelete()}>确认删除</button>
        </div>
      </div>
    </div>
  );
}
