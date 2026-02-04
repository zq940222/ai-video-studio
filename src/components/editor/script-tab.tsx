'use client';

import { useState, useEffect } from 'react';
import { ScriptEditor } from './script-editor';
import { Loader2 } from 'lucide-react';

interface Script {
  id: string;
  content: string;
  scriptContent: string | null;
  version: number;
  createdAt: Date;
}

interface ScriptTabProps {
  projectId: string;
}

export function ScriptTab({ projectId }: ScriptTabProps) {
  const [script, setScript] = useState<Script | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchScript() {
      try {
        const response = await fetch(`/api/projects/${projectId}/scripts`);
        if (response.ok) {
          const scripts = await response.json();
          // Get the latest script
          if (scripts.length > 0) {
            setScript(scripts[0]);
          }
        }
      } catch (error) {
        console.error('Failed to fetch script:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchScript();
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <ScriptEditor
      projectId={projectId}
      initialScript={script}
      onScriptGenerated={(newScript) => setScript(newScript)}
    />
  );
}
