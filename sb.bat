@echo off
rem Kurzer Wrapper für die lokale Supabase CLI (devDependency im backend).
rem Benutzung aus dem Projekt-Root: sb login / sb link --project-ref XYZ / sb db push
"%~dp0backend\node_modules\.bin\supabase.cmd" %*
