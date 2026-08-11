const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'src', 'routes');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.ts'));

files.forEach(file => {
  const filePath = path.join(routesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  if (content.includes('adminOnly') || content.includes('staffOnly') || content.includes('managerOnly')) {
    // If it hasn't been migrated yet (or partially migrated)
    if (!content.includes('requirePermission')) {
       content = content.replace(/import \{ protect, (.*?)\} from '\.\.\/middleware\/auth\.js';/, "import { protect, requirePermission } from '../middleware/auth.js';");
    } else {
       content = content.replace(/import \{ protect, .*?requirePermission.*?\} from '\.\.\/middleware\/auth\.js';/, "import { protect, requirePermission } from '../middleware/auth.js';");
    }
    
    // Naive fallback replacements for routes we didn't do manually
    if (file === 'reviews.ts') {
       content = content.replace(/adminOnly/g, "requirePermission('reviews.delete')");
       content = content.replace(/staffOnly/g, "requirePermission('reviews.approve')");
    } else if (file === 'operations.ts') {
       content = content.replace(/managerOnly/g, "requirePermission('dashboard.view')");
       content = content.replace(/staffOnly/g, "requirePermission('dashboard.view')");
    } else if (file === 'careers.ts') {
       content = content.replace(/adminOnly/g, "requirePermission('careers.delete')");
       content = content.replace(/staffOnly/g, "requirePermission('careers.edit')");
    } else if (file === 'coupons.ts') {
       content = content.replace(/adminOnly/g, "requirePermission('packages.delete')");
       content = content.replace(/staffOnly/g, "requirePermission('packages.create')");
    } else if (file === 'upload.ts') {
       content = content.replace(/staffOnly/g, "requirePermission('packages.create')");
    } else if (file === 'articles.ts') {
       content = content.replace(/adminOnly/g, "requirePermission('dashboard.view')");
       content = content.replace(/staffOnly/g, "requirePermission('dashboard.view')");
    } else if (file === 'newsletter.ts') {
       content = content.replace(/adminOnly/g, "requirePermission('newsletter.export')");
       content = content.replace(/managerOnly/g, "requirePermission('newsletter.view')");
    } else if (file === 'vendors.ts') {
       content = content.replace(/adminOnly/g, "requirePermission('dashboard.view')");
       content = content.replace(/staffOnly/g, "requirePermission('dashboard.view')");
    } else if (file === 'packageTemplates.ts') {
       content = content.replace(/adminOnly/g, "requirePermission('packages.delete')");
       content = content.replace(/staffOnly/g, "requirePermission('packages.create')");
    }
    
    fs.writeFileSync(filePath, content);
  }
});
console.log('Done refactoring');
