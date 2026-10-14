import type { ComponentType } from "react";

export type GalleryEntry = {
  id: string;
  title: string;
  family: string;
  level: "Fondations" | "Atomes" | "Molécules" | "Organismes" | "Templates et pages";
  origin: string;
  version: string;
  source: string;
  description: string;
  Component: ComponentType;
};
