export type XessexContentItem = {
  id: string;
  title: string;
  previewUrl: string;
  videoUrl: string;
  thumbnailUrl: string;
  unlockCost: number;
};

export const XESSEX_CONTENT: XessexContentItem[] = [
  {
    id: "pink-blonde-1",
    title: "Pink Blonde",
    previewUrl:
      "https://pub-3be2d42bdfdd4dba95d39ef9bd537016.r2.dev/pinkblondevideo1_preview.mp4",
    videoUrl:
      "https://pub-3be2d42bdfdd4dba95d39ef9bd537016.r2.dev/pinkblondevideo1.mp4",
    thumbnailUrl:
      "https://pub-3be2d42bdfdd4dba95d39ef9bd537016.r2.dev/pinkblondevideo1.gif",
    unlockCost: 1000,
  },
];

export function getContentById(id: string) {
  return XESSEX_CONTENT.find((c) => c.id === id) ?? null;
}
