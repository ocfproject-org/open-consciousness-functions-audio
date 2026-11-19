/* Original optional reflection prompts, authored for OCF. Stable IDs are never reused. */
((root) => {
  'use strict';
  const groups = [
    ['letting-go', 'Letting go & beliefs', ['I can question a familiar belief without judging my past self.', 'I make room for what matters by releasing one small burden.', 'A change of mind can be a thoughtful choice.']],
    ['self-kindness', 'Self-kindness & body respect', ['My body deserves ordinary care, even on difficult days.', 'I can speak to myself with the patience I offer a friend.', 'Rest belongs in my plans, not just after them.']],
    ['confidence', 'Confidence & boundaries', ['I can give a clear answer without a long apology.', 'My boundaries can be kind and firm at once.', 'I can take a small brave step while feeling uncertain.']],
    ['calm', 'Calm & steadiness', ['This moment does not require every answer.', 'I can pause before choosing my next response.', 'I give one thing my attention and let the rest wait.']],
    ['purpose', 'Purpose & values', ['A useful day can begin with one deliberate choice.', 'I can choose a direction without knowing the whole route.', 'Small choices can express what I care about.']],
    ['gratitude', 'Gratitude & opportunity', ['I notice one ordinary thing that supports my day.', 'I can appreciate what is here and still want change.', 'I stay curious about an invitation I might otherwise miss.']],
    ['connection', 'Love & friendship', ['I can offer attention without trying to fix everything.', 'I make room for relationships where care moves both ways.', 'A small honest conversation can bring us closer.']],
    ['creativity', 'Creativity', ['A rough first attempt gives my ideas somewhere to begin.', 'I can play with an idea before deciding whether it works.', 'My curiosity deserves a little space today.']],
    ['follow-through', 'Motivation & follow-through', ['I can make the next step small enough to start.', 'Returning to a task counts, even after an interruption.', 'I choose a workable pace over an impressive promise.']],
    ['learning', 'Learning & focus', ['Not knowing yet leaves room to learn.', 'I can ask a precise question when I feel stuck.', 'One focused interval is a worthwhile beginning.']],
    ['work', 'Work & teamwork', ['I can make my needs and next steps clear to my team.', 'Listening carefully can be a useful contribution.', 'I can ask for help before a problem grows.']],
    ['perspective', 'Perspective & everyday choices', ['A difficult moment is part of my day, not its whole story.', 'I can choose what deserves my energy next.', 'I leave room in my plans for being human.']],
  ];
  const data = {categories: Object.fromEntries(groups.map(([id, label]) => [id, label])), lines: groups.flatMap(([category, , lines]) => lines.map((text, i) => ({id: `starter:${category}:${i + 1}`, category, text})))};
  if (typeof module !== 'undefined' && module.exports) module.exports = data;
  else root.ocfAffirmationsData = data;
})(globalThis);
