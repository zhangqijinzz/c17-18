import { useState } from 'react';
import type { StoryScene } from '../models/story';
import type { StoryViewModel } from '../viewmodels/storyViewModel';

interface CluePanelProps { viewModel: StoryViewModel; scenes: StoryScene[]; }

export function CluePanel({ viewModel, scenes }: CluePanelProps) {
  const [title, setTitle] = useState('');
  const [setup, setSetup] = useState(scenes[0]?.id ?? '');
  const [payoff, setPayoff] = useState('');
  const story = viewModel.snapshot.story;
  const submit = () => { viewModel.addClue(title, setup, payoff); setTitle(''); };
  return (
    <section className="panel clue-panel">
      <div className="panel-heading"><div><span className="eyebrow">THREADS / 叙事线索</span><h2>伏笔关系</h2></div><span className="unresolved"><i /> {viewModel.snapshot.stats.unresolvedClues} 个待回收</span></div>
      <div className="clue-list">{story?.clues.map((clue) => <div className="clue-row" key={clue.id}><span className="clue-symbol">⌁</span><div><strong>{clue.title}</strong><span>{clue.setupSceneId ? scenes.find((scene) => scene.id === clue.setupSceneId)?.title ?? '待指定埋下场景' : <em className="clue-pending">待指定埋下场景</em>} <b>→</b> {clue.payoffSceneId ? scenes.find((scene) => scene.id === clue.payoffSceneId)?.title ?? '待回收' : '待回收'}</span></div><em className={clue.payoffSceneId ? 'resolved' : ''}>{clue.payoffSceneId ? '已回收' : '未回收'}</em><button className="item-delete" onClick={() => viewModel.requestDelete('clue', clue.id)} aria-label={`删除伏笔 ${clue.title}`} title="删除伏笔">✕</button></div>)}</div>
      <div className="clue-form"><input aria-label="伏笔名称" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="伏笔名称，例如：罗盘上的刻痕" /><select aria-label="埋下场景" value={setup} onChange={(event) => setSetup(event.target.value)}><option value="">埋下场景…</option>{scenes.map((scene) => <option key={scene.id} value={scene.id}>{scene.title}</option>)}</select><select aria-label="回收场景" value={payoff} onChange={(event) => setPayoff(event.target.value)}><option value="">回收场景（稍后）</option>{scenes.map((scene) => <option key={scene.id} value={scene.id}>{scene.title}</option>)}</select><button onClick={submit}>建立关系</button></div>
    </section>
  );
}
