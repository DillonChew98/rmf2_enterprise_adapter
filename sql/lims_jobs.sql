select Job6Custom.JobNumber as 'Job Number', Job6Custom.Type as 'Analysis Type', Job6Custom.XTime as 'Submission Time',
CASE Job6Custom.Status WHEN 'A' THEN 'Assigned' WHEN 'P' THEN 'In Progress' END AS 'Status',
MAX(CASE WHEN Entity.EntityTypeID = 48 THEN Entity.DisplayName END) AS 'Stain'
from Entity
left join EntityLinks on Entity.pkGlobalEntityID = EntityLinks.RelatedEntityID AND EntityLinks.fkEntityRelationshipID IN (129,130)
left join JobRecipeView on EntityLinks.EntityID = JobRecipeView.pkID
left join Job6Custom on Job6Custom.JobNumber = JobRecipeView.JobNumber
where Entity.EntityTypeID IN (48, 49) AND Job6Custom.Status IN ('A', 'P') AND Job6Custom.Type = 'SEM'
group by Job6Custom.JobNumber, Job6Custom.Status, Job6Custom.Type, Job6Custom.XTime
