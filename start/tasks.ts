/*
|--------------------------------------------------------------------------
| Background Tasks
|--------------------------------------------------------------------------
|
| This file starts background tasks when the application boots.
|
*/

import { wantedSearchTask } from '#services/tasks/wanted_search_task'

// Start the wanted album search task (runs every 60 minutes)
// Delay start by 30 seconds to let the app fully initialize
setTimeout(() => {
  wantedSearchTask.start(60)
}, 30000)
