-- Lien de la chambre de démonstration sans « demo » : /c/demo304corniche devient /c/corniche304
UPDATE "Chambre" SET "jetonQr" = 'corniche304'
WHERE "jetonQr" = 'demo304corniche'
  AND NOT EXISTS (SELECT 1 FROM "Chambre" WHERE "jetonQr" = 'corniche304');
