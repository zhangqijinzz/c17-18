import type { StoryViewModel } from '../viewmodels/storyViewModel';

interface DeleteConfirmDialogProps { viewModel: StoryViewModel; }

export function DeleteConfirmDialog({ viewModel }: DeleteConfirmDialogProps) {
  const pending = viewModel.snapshot.pendingDeletion;
  if (!pending) return null;
  return (
    <div className="dialog-backdrop" role="presentation">
      <div className="confirm-dialog" role="alertdialog" aria-modal="true" aria-label="删除确认">
        <span className="eyebrow">DELETE / 删除确认</span>
        <h2>删除{pending.title}？</h2>
        <p className="dialog-lead">删除后无法撤销，请先确认会同步影响的内容：</p>
        <ul>
          {pending.consequences.map((line) => <li key={line}>{line}</li>)}
        </ul>
        <div className="dialog-actions">
          <button className="secondary-button" onClick={() => viewModel.cancelDeletion()}>再想想</button>
          <button className="danger-button" onClick={() => viewModel.confirmDeletion()}>确认删除</button>
        </div>
      </div>
    </div>
  );
}
