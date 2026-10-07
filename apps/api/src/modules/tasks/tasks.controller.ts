import type {
  ActivityEntry,
  ActivityQuery,
  CreateTaskInput,
  DataResponse,
  IdParam,
  ListResponse,
  ListTasksQuery,
  Task,
  UpdateTaskInput,
} from '@tidyr/shared';
import type { RequestHandler } from 'express';
import { currentUser } from '../../middleware/authenticate';
import * as audit from '../audit/audit.service';
import * as tasksService from './tasks.service';

export const list: RequestHandler = async (req, res) => {
  const query = req.validated.query as ListTasksQuery;
  const body: ListResponse<Task> = await tasksService.list(currentUser(req).id, query);
  res.json(body);
};

export const get: RequestHandler = async (req, res) => {
  const { id } = req.validated.params as IdParam;
  const body: DataResponse<Task> = { data: await tasksService.get(currentUser(req).id, id) };
  res.json(body);
};

export const create: RequestHandler = async (req, res) => {
  const input = req.validated.body as CreateTaskInput;
  const body: DataResponse<Task> = { data: await tasksService.create(currentUser(req).id, input) };
  res.status(201).json(body);
};

export const update: RequestHandler = async (req, res) => {
  const { id } = req.validated.params as IdParam;
  const input = req.validated.body as UpdateTaskInput;
  const body: DataResponse<Task> = {
    data: await tasksService.update(currentUser(req).id, id, input),
  };
  res.json(body);
};

export const remove: RequestHandler = async (req, res) => {
  const { id } = req.validated.params as IdParam;
  await tasksService.remove(currentUser(req).id, id);
  res.status(204).end();
};

export const activity: RequestHandler = async (req, res) => {
  const { id } = req.validated.params as IdParam;
  const query = req.validated.query as ActivityQuery;
  const body: ListResponse<ActivityEntry> = await audit.listForTask(currentUser(req).id, id, query);
  res.json(body);
};
