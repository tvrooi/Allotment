import { Router } from 'express';
import { bufferState, guideState, reviewState } from '../services/reviewService.js';

export const reviewRouter = Router();
// Read-only: the review, buffer and guided setup only describe the shared funding figures.
reviewRouter.get('/', (_req, res) => res.json(reviewState()));
reviewRouter.get('/buffer', (_req, res) => res.json(bufferState()));
reviewRouter.get('/guide', (_req, res) => res.json(guideState()));
