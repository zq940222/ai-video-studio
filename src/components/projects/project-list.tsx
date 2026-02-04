'use client';

import { ProjectCard } from './project-card';

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: 'draft' | 'in_progress' | 'completed' | 'archived';
  updatedAt: Date;
}

interface ProjectListProps {
  projects: Project[];
}

export function ProjectList({ projects }: ProjectListProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}
