/**
 * Project manager for creating and managing project configuration files
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { Project, Repository } from '../models/types';
import { getProjectsDir } from '../config/paths';

export interface CreateProjectData {
  id: string;
  name: string;
  description?: string;
  repositories: Array<{
    name: string;
    path: string;
    defaultBranch?: string;
  }>;
}

export class ProjectManager {
  constructor(private configDir: string) {}

  /**
   * Check if project ID already exists
   */
  projectExists(projectId: string): boolean {
    const projectsDir = getProjectsDir(this.configDir);
    const projectFile = path.join(projectsDir, `${projectId}.yaml`);
    return fs.existsSync(projectFile);
  }

  /**
   * Create new project configuration file
   */
  createProject(data: CreateProjectData): void {
    const projectsDir = getProjectsDir(this.configDir);

    // Ensure projects directory exists
    if (!fs.existsSync(projectsDir)) {
      fs.mkdirSync(projectsDir, { recursive: true });
    }

    // Check if project already exists
    if (this.projectExists(data.id)) {
      throw new Error(`Project "${data.id}" already exists`);
    }

    // Build YAML content
    const yamlContent: any = {
      name: data.name,
      repositories: data.repositories.map(repo => ({
        name: repo.name,
        path: repo.path,
        default_branch: repo.defaultBranch || 'main',
        remote: 'origin'
      }))
    };

    if (data.description) {
      yamlContent.description = data.description;
    }

    // Write YAML file
    const projectFile = path.join(projectsDir, `${data.id}.yaml`);
    const content = yaml.stringify(yamlContent);
    fs.writeFileSync(projectFile, content, 'utf-8');
  }

  /**
   * Update existing project
   */
  updateProject(projectId: string, data: Partial<CreateProjectData>): void {
    const projectsDir = getProjectsDir(this.configDir);
    const projectFile = path.join(projectsDir, `${projectId}.yaml`);

    if (!fs.existsSync(projectFile)) {
      throw new Error(`Project "${projectId}" not found`);
    }

    // Read existing content
    const content = fs.readFileSync(projectFile, 'utf-8');
    const existing = yaml.parse(content) || {};

    // Merge changes
    if (data.name) {
      existing.name = data.name;
    }
    if (data.description !== undefined) {
      existing.description = data.description;
    }
    if (data.repositories) {
      existing.repositories = data.repositories.map(repo => ({
        name: repo.name,
        path: repo.path,
        default_branch: repo.defaultBranch || 'main',
        remote: 'origin'
      }));
    }

    // Write updated content
    const newContent = yaml.stringify(existing);
    fs.writeFileSync(projectFile, newContent, 'utf-8');
  }

  /**
   * Delete project configuration file
   */
  deleteProject(projectId: string): void {
    const projectsDir = getProjectsDir(this.configDir);
    const projectFile = path.join(projectsDir, `${projectId}.yaml`);

    if (!fs.existsSync(projectFile)) {
      throw new Error(`Project "${projectId}" not found`);
    }

    fs.unlinkSync(projectFile);
  }

  /**
   * Get project file path
   */
  getProjectFilePath(projectId: string): string {
    const projectsDir = getProjectsDir(this.configDir);
    return path.join(projectsDir, `${projectId}.yaml`);
  }
}
