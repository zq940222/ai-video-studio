import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { projects, scripts, scenes } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Image, Video, Mic, Music, Layers, Download } from 'lucide-react';
import { ProjectHeader } from '@/components/projects/project-header';
import { ScriptTab } from '@/components/editor/script-tab';
import { StoryboardTab } from '@/components/editor/storyboard-tab';
import { VideoTab } from '@/components/editor/video-tab';
import { VoiceTab } from '@/components/editor/voice-tab';
import { MusicTab } from '@/components/editor/music-tab';
import { TimelineTab } from '@/components/editor/timeline-tab';
import { ExportTab } from '@/components/editor/export-tab';

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params;
  const session = await auth();

  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, id),
      eq(projects.userId, session!.user.id)
    ),
  });

  if (!project) {
    notFound();
  }

  // Check if project has a script with scriptContent
  const latestScript = await db.query.scripts.findFirst({
    where: eq(scripts.projectId, id),
    orderBy: [desc(scripts.version)],
  });
  const hasScript = !!latestScript?.scriptContent;

  // Check if project has scenes (storyboard generated)
  let hasScenes = false;
  if (latestScript) {
    const sceneCount = await db.query.scenes.findFirst({
      where: eq(scenes.scriptId, latestScript.id),
    });
    hasScenes = !!sceneCount;
  }

  return (
    <div className="space-y-6">
      <ProjectHeader project={project} />

      <Tabs defaultValue="script" className="space-y-6">
        <TabsList className="bg-slate-800 border-slate-700">
          <TabsTrigger value="script" className="data-[state=active]:bg-slate-700">
            <FileText className="h-4 w-4 mr-2" />
            剧本
          </TabsTrigger>
          <TabsTrigger value="storyboard" className="data-[state=active]:bg-slate-700">
            <Image className="h-4 w-4 mr-2" />
            分镜
          </TabsTrigger>
          <TabsTrigger value="video" className="data-[state=active]:bg-slate-700">
            <Video className="h-4 w-4 mr-2" />
            视频
          </TabsTrigger>
          <TabsTrigger value="voice" className="data-[state=active]:bg-slate-700">
            <Mic className="h-4 w-4 mr-2" />
            配音
          </TabsTrigger>
          <TabsTrigger value="music" className="data-[state=active]:bg-slate-700">
            <Music className="h-4 w-4 mr-2" />
            配乐
          </TabsTrigger>
          <TabsTrigger value="timeline" className="data-[state=active]:bg-slate-700">
            <Layers className="h-4 w-4 mr-2" />
            时间线
          </TabsTrigger>
          <TabsTrigger value="export" className="data-[state=active]:bg-slate-700">
            <Download className="h-4 w-4 mr-2" />
            导出
          </TabsTrigger>
        </TabsList>

        <TabsContent value="script">
          <ScriptTab projectId={id} />
        </TabsContent>

        <TabsContent value="storyboard">
          <StoryboardTab projectId={id} hasScript={hasScript} />
        </TabsContent>

        <TabsContent value="video">
          <VideoTab projectId={id} hasScenes={hasScenes} />
        </TabsContent>

        <TabsContent value="voice">
          <VoiceTab projectId={id} hasScript={hasScript} />
        </TabsContent>

        <TabsContent value="music">
          <MusicTab projectId={id} />
        </TabsContent>

        <TabsContent value="timeline">
          <TimelineTab projectId={id} />
        </TabsContent>

        <TabsContent value="export">
          <ExportTab projectId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
