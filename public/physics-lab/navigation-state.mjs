// Public navigation only: no account identifiers, observations or scene data.
import { EXPLORATIONS, TOPICS } from './exploration-model.mjs';
import { LESSONS } from './learning-model.mjs';

const experiments = new Set(EXPLORATIONS.map(item => item.id));
const lessons = new Set(LESSONS.map(item => item.id));
const topics = new Set(['all', ...TOPICS.map(item => item.id)]);
const stages = new Set(['all', 'primary', 'middle', 'high']);
export const NAVIGATION_KEYS = ['experiment', 'lesson', 'stage', 'topic', 'q', 'page'];
export const defaultNavigation = () => ({ experiment: null, lesson: null, stage: 'all', topic: 'all', query: '', page: 1 });

export function normalizeNavigation(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const { experiment, lesson, stage, topic, query, page } = input;
  if (experiment !== null && (typeof experiment !== 'string' || !experiments.has(experiment))) return null;
  if (lesson !== null && (typeof lesson !== 'string' || !lessons.has(lesson) || experiment !== 'circuit')) return null;
  if (!stages.has(stage) || !topics.has(topic) || typeof query !== 'string' || query.length > 120 || !Number.isSafeInteger(page) || page < 1 || page > 1000) return null;
  return { experiment, lesson, stage, topic, query, page };
}

export function parseNavigation(search = '') {
  const params = new URLSearchParams(search), route = defaultNavigation();
  if (experiments.has(params.get('experiment'))) route.experiment = params.get('experiment');
  if (lessons.has(params.get('lesson')) && (!params.has('experiment') || route.experiment === 'circuit')) {
    route.experiment = 'circuit'; route.lesson = params.get('lesson');
  }
  if (stages.has(params.get('stage'))) route.stage = params.get('stage');
  if (topics.has(params.get('topic'))) route.topic = params.get('topic');
  route.query = (params.get('q') || '').slice(0, 120);
  const page = Number(params.get('page'));
  if (Number.isSafeInteger(page) && page >= 1 && page <= 1000) route.page = page;
  return route;
}

export function navigationSearch(input) {
  const route = normalizeNavigation(input);
  if (!route) return '';
  const params = new URLSearchParams();
  if (route.experiment) params.set('experiment', route.experiment);
  if (route.lesson) params.set('lesson', route.lesson);
  if (route.stage !== 'all') params.set('stage', route.stage);
  if (route.topic !== 'all') params.set('topic', route.topic);
  if (route.query) params.set('q', route.query);
  if (route.page !== 1) params.set('page', String(route.page));
  return params.size ? '?' + params.toString() : '';
}
