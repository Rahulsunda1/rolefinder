import { rankRoles as rankAll } from './web/ranking.mjs';
export function rankRoles(jobs, resume) {
  return rankAll(jobs, resume).filter(job => job.score > 0 && job.matched.some(word => word !== 'engineer'));
}
