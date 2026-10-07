import type {
  ActivityEntry,
  ActivityQuery,
  CreateProjectInput,
  DataResponse,
  IdParam,
  ListProjectsQuery,
  ListResponse,
  Project,
  UpdateProjectInput,
} from '@tidyr/shared';
import type { RequestHandler } from 'express';
import { currentUser } from '../../middleware/authenticate';
import * as audit from '../audit/audit.service';
import * as projectsService from './projects.service';

export const list: RequestHandler = async (req, res) => {
  const query = req.validated.query as ListProjectsQuery;
  const body: ListResponse<Project> = await projectsService.list(currentUser(req).id, query);
  res.json(body);
};

export const get: RequestHandler = async (req, res) => {
  const { id } = req.validated.params as IdParam;
  const body: DataResponse<Project> = { data: await projectsService.get(currentUser(req).id, id) };
  res.json(body);
};

export const create: RequestHandler = async (req, res) => {
  const input = req.validated.body as CreateProjectInput;
  const body: DataResponse<Project> = {
    data: await projectsService.create(currentUser(req).id, input),
  };
  res.status(201).json(body);
};

export const update: RequestHandler = async (req, res) => {
  const { id } = req.validated.params as IdParam;
  const input = req.validated.body as UpdateProjectInput;
  const body: DataResponse<Project> = {
    data: await projectsService.update(currentUser(req).id, id, input),
  };
  res.json(body);
};

export const remove: RequestHandler = async (req, res) => {
  const { id } = req.validated.params as IdParam;
  await projectsService.remove(currentUser(req).id, id);
  res.status(204).end();
};

export const activity: RequestHandler = async (req, res) => {
  const { id } = req.validated.params as IdParam;
  const query = req.validated.query as ActivityQuery;
  const body: ListResponse<ActivityEntry> = await audit.listForProject(
    currentUser(req).id,
    id,
    query,
  );
  res.json(body);
};
