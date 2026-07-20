const fs = require('fs');
let code = fs.readFileSync('client/src/pages/clients.tsx', 'utf8');

// Replace Client with Route
code = code.replace(/Client/g, 'Route');
code = code.replace(/client/g, 'route');
code = code.replace(/Clients/g, 'Routes');
code = code.replace(/clients/g, 'routes');

// Fix brandId and routeId in Outlet
code = code.replace(/routeId/g, 'routeId'); // already replaced clientId -> routeId
code = code.replace(/routeId\?/g, 'routeId?');

fs.writeFileSync('client/src/pages/routes.tsx', code);
