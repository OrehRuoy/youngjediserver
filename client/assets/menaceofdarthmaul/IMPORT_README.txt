Card images (GIF files) in the "dark" and "light" folders must be imported by Godot for in-game card images to show.

If you see only card names (no images) in hand or in-play:

1. Ensure your project root is the folder that contains project.godot (the "client" folder). The card image files must be inside that folder at: assets/menaceofdarthmaul/dark/ and assets/menaceofdarthmaul/light/

2. In Godot menu: Project -> Reload Current Project
   Wait for the import progress at the bottom to finish (can take a minute with many GIFs).

3. If the FileSystem dock still does not list the .gif files inside dark/ or light/, the files may not be in the project directory on disk, or Godot may need to be restarted after copying the files into assets/menaceofdarthmaul/.

After Godot has imported the card images, run the game again; card images should load.
