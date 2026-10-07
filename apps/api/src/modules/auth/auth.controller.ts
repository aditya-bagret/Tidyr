import type {
  AuthResult,
  DataResponse,
  LoginInput,
  RefreshInput,
  RegisterInput,
  TokenPair,
  User,
} from '@tidyr/shared';
import type { Request, RequestHandler } from 'express';
import { currentUser } from '../../middleware/authenticate';
import * as authService from './auth.service';

const clientInfo = (req: Request): authService.ClientInfo => ({ userAgent: req.get('user-agent') });

export const register: RequestHandler = async (req, res) => {
  const input = req.validated.body as RegisterInput;
  const body: DataResponse<AuthResult> = {
    data: await authService.register(input, clientInfo(req)),
  };
  res.status(201).json(body);
};

export const login: RequestHandler = async (req, res) => {
  const input = req.validated.body as LoginInput;
  const body: DataResponse<AuthResult> = { data: await authService.login(input, clientInfo(req)) };
  res.json(body);
};

export const refresh: RequestHandler = async (req, res) => {
  const { refreshToken } = req.validated.body as RefreshInput;
  const body: DataResponse<TokenPair> = { data: await authService.refresh(refreshToken) };
  res.json(body);
};

export const logout: RequestHandler = async (req, res) => {
  const { id, sessionId } = currentUser(req);
  await authService.logout(id, sessionId);
  res.status(204).end();
};

export const me: RequestHandler = async (req, res) => {
  const body: DataResponse<User> = { data: await authService.getMe(currentUser(req).id) };
  res.json(body);
};
