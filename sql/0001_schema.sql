-- Mock LIMS schema. Table/column names match the real SQL Server LIMS so the
-- verbatim query in sql/lims_jobs.sql runs unchanged. Identifiers are left
-- unquoted (SQL Server is case-insensitive for unquoted identifiers).

IF DB_ID('LIMS') IS NULL
    CREATE DATABASE LIMS;
GO

USE LIMS;
GO

IF OBJECT_ID('dbo.Job6Custom', 'U') IS NOT NULL DROP TABLE dbo.Job6Custom;
IF OBJECT_ID('dbo.JobRecipeView', 'U') IS NOT NULL DROP TABLE dbo.JobRecipeView;
IF OBJECT_ID('dbo.EntityLinks', 'U') IS NOT NULL DROP TABLE dbo.EntityLinks;
IF OBJECT_ID('dbo.Entity', 'U') IS NOT NULL DROP TABLE dbo.Entity;
GO

CREATE TABLE dbo.Entity (
    pkGlobalEntityID INT           NOT NULL,
    EntityTypeID     INT           NOT NULL,
    DisplayName      NVARCHAR(200) NULL
);

CREATE TABLE dbo.EntityLinks (
    RelatedEntityID        INT NOT NULL,
    fkEntityRelationshipID INT NOT NULL,
    EntityID               INT NOT NULL
);

-- Real LIMS exposes this as a view; a table is sufficient for the mock.
CREATE TABLE dbo.JobRecipeView (
    pkID      INT          NOT NULL,
    JobNumber NVARCHAR(50) NOT NULL
);

CREATE TABLE dbo.Job6Custom (
    JobNumber NVARCHAR(50) NOT NULL,
    Type      NVARCHAR(50) NULL,
    XTime     DATETIME     NULL,
    Status    CHAR(1)      NULL
);
GO
