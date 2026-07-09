#!/usr/bin/env bash
# Insert a new SEM job into the live mock LIMS (SQL Server container), across the
# Job6Custom / JobRecipeView / Entity / EntityLinks tables so the LIMS query
# returns it. The adapter picks it up on its next poll → it appears in the UI.
#
# Usage:
#   ./add_lims_job.sh <JobNumber> [Assigned|InProgress] [Stain]
# Example:
#   ./add_lims_job.sh F1026-99999 Assigned "BOE stain"

set -euo pipefail

JOB="${1:?Usage: ./add_lims_job.sh <JobNumber> [Assigned|InProgress] [Stain]}"
STATUS_IN="${2:-InProgress}"
STAIN="${3:-NA}"
PASS="${MSSQL_SA_PASSWORD:-Your_strong_Pass123}"
CONTAINER="${MSSQL_CONTAINER:-enterprise-adapter-mssql}"

case "$STATUS_IN" in
  A|Assigned|assigned)      S=A ;;
  *)                        S=P ;;
esac

docker exec "$CONTAINER" /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P "$PASS" -C -d LIMS -Q "
DECLARE @pk  INT = (SELECT ISNULL(MAX(pkID),0)+1            FROM dbo.JobRecipeView);
DECLARE @ent INT = (SELECT ISNULL(MAX(pkGlobalEntityID),0)+1 FROM dbo.Entity);
INSERT INTO dbo.Job6Custom (JobNumber, Type, XTime, Status) VALUES ('$JOB','SEM', GETDATE(), '$S');
INSERT INTO dbo.JobRecipeView (pkID, JobNumber)                    VALUES (@pk, '$JOB');
INSERT INTO dbo.Entity (pkGlobalEntityID, EntityTypeID, DisplayName) VALUES (@ent, 48, '$STAIN');
INSERT INTO dbo.EntityLinks (RelatedEntityID, fkEntityRelationshipID, EntityID) VALUES (@ent, 129, @pk);
"

echo "Inserted $JOB ($STATUS_IN, stain: $STAIN) into the live LIMS."
