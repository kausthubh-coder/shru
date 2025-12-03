import { SpaceDefinition, SpaceKind } from "@/types/space";
import WhiteboardSpace from "./WhiteboardSpace";
import IDESpace from "./IDESpace";
import LessonSpace from "./LessonSpace";

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
