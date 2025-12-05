import dynamic from "next/dynamic";
import { SpaceDefinition, SpaceKind } from "@/types/space";

// Lazy-load heavy space components so listing spaces doesn't pull their bundles
const WhiteboardSpace = dynamic(() => import("./WhiteboardSpace"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-gray-500">
      Loading Whiteboard...
    </div>
  ),
});

const IDESpace = dynamic(() => import("./IDESpace"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-gray-500">
      Loading IDE...
    </div>
  ),
});

const LessonSpace = dynamic(() => import("./LessonSpace"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-gray-500">
      Loading Lesson...
    </div>
  ),
});

export const SPACE_REGISTRY: Record<SpaceKind, SpaceDefinition> = {
  whiteboard: {
    id: "whiteboard",
    name: "Whiteboard",
    description: "Collaborative infinite canvas",
    component: WhiteboardSpace,
  },
  ide: {
    id: "ide",
    name: "IDE",
    description: "Code editor with Python execution",
    component: IDESpace,
  },
  lesson: {
    id: "lesson",
    name: "Lesson",
    description: "YAML-based lesson / notes",
    component: LessonSpace,
  },
};

export const AVAILABLE_SPACES = Object.values(SPACE_REGISTRY);
