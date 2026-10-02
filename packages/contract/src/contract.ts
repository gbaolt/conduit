import { healthCheckContract } from './contracts/health';
import { getSessionContract } from './contracts/users';

export const contract = {
  health: {
    check: healthCheckContract,
  },
  users: {
    getSession: getSessionContract,
  },
};
