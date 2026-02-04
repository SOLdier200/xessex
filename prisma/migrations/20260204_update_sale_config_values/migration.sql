-- Update SaleConfig with correct allocation values
UPDATE "SaleConfig" SET 
  "walletCapXess" = 10000000,
  "privateAllocation" = 200000000,
  "publicAllocation" = 150000000
WHERE "walletCapXess" = 5000000 OR "privateAllocation" = 35000000;
