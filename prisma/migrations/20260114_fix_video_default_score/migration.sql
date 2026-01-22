-- Update all videos with adminScore of 50 to the correct default of 75
UPDATE "Video" SET "adminScore" = 75 WHERE "adminScore" = 50;
