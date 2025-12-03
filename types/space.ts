import { ComponentType } from "react";

export type SpaceKind = "whiteboard" | "ide" | "lesson";

export interface SpaceProps<T = any> {
  initialContent?: T | null;
  onContentChange: (next: T) => void;
  isActive: boolean;
  readOnly?: boolean;
}

export type SpaceComponent<T = any> = ComponentType<SpaceProps<T>>;

export interface SpaceDefinition<T = any> {
  id: SpaceKind;
  name: string;
  description: string;
  component: SpaceComponent<T>;
}

