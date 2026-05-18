const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, callback);
    } else {
      callback(dirPath);
    }
  });
}

console.log('Applying secure database rewiring...');

// 1. Rewrite driver_jobs to point to the driver schema instead of parcel schema
walkDir(srcDir, (filePath) => {
  if (!filePath.endsWith('.ts') && !filePath.endsWith('.js')) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  
  content = content.replace(/\.schema\("parcel"\)\s*\.\s*from\("driver_jobs"\)/g, '.schema("driver").from("driver_jobs")');
  content = content.replace(/\.schema\('parcel'\)\s*\.\s*from\('driver_jobs'\)/g, ".schema('driver').from('driver_jobs')");
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`[Wired] driver_jobs -> driver schema: ${path.relative(srcDir, filePath)}`);
  }
});

// 2. Rewrite customer-dashboard.service.ts reviews to point to parcel.parcel_reviews
const dashboardServicePath = path.join(srcDir, 'customer-dashboard', 'customer-dashboard.service.ts');
if (fs.existsSync(dashboardServicePath)) {
  let content = fs.readFileSync(dashboardServicePath, 'utf8');
  
  // Replace getRecentReviews query
  content = content.replace(
    /\.schema\("account"\)\s*\.\s*from\("customer_reviews"\)\s*\.\s*select\("id,\s*tracking_number,\s*rating,\s*review_text,\s*tags,\s*created_at"\)\s*\.\s*eq\("user_id",\s*session\.userId\)/g,
    '.schema("parcel").from("parcel_reviews").select("id, tracking_number, rating, review_text, tags, created_at").eq("customer_user_id", session.userId)'
  );
  
  // Replace submitReview insert
  content = content.replace(
    /const insertResult = await admin\s*\.\s*schema\("account"\)\s*\.\s*from\("customer_reviews"\)\s*\.\s*insert\(\{\s*user_id:\s*session\.userId,\s*tracking_number:\s*trackingNumber,\s*rating,\s*review_text:\s*review \|\| null,\s*tags,\s*\}\)/g,
    `const insertResult = await admin
      .schema("parcel")
      .from("parcel_reviews")
      .insert({
        parcel_draft_id: ownedBooking.data.id,
        tracking_number: trackingNumber,
        customer_user_id: session.userId,
        rating,
        review_text: review || null,
        tags,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })`
  );

  // Re-enable driver_jobs update inside submitReview too
  content = content.replace(
    /if \(insertResult\.error \|\| !insertResult\.data\) \{\s*throw new InternalServerErrorException\("Unable to submit your review right now\."\);\s*\}/g,
    `if (insertResult.error || !insertResult.data) {
      throw new InternalServerErrorException("Unable to submit your review right now.");
    }

    // Update driver_jobs rating if a driver was assigned
    if (ownedBooking.data.assigned_driver_id) {
      await admin
        .schema("driver")
        .from("driver_jobs")
        .update({ rating })
        .eq("parcel_draft_id", ownedBooking.data.id)
        .eq("driver_user_id", ownedBooking.data.assigned_driver_id);
    }`
  );

  // Update ownedBooking to fetch assigned_driver_id
  content = content.replace(
    /\.select\("id"\)\s*\.\s*eq\("user_id",\s*session\.userId\)\s*\.\s*eq\("tracking_number",\s*trackingNumber\)\s*\.\s*eq\("status",\s*"submitted"\)\s*\.\s*maybeSingle\(\)/g,
    '.select("id, assigned_driver_id").eq("user_id", session.userId).eq("tracking_number", trackingNumber).eq("status", "submitted").maybeSingle() as any'
  );

  fs.writeFileSync(dashboardServicePath, content, 'utf8');
  console.log('[Wired] customer_reviews -> parcel.parcel_reviews');
}

// 3. Fix getAvailableHubs signature in parcel-drafts.service.ts
const draftsServicePath = path.join(srcDir, 'parcel-drafts', 'parcel-drafts.service.ts');
if (fs.existsSync(draftsServicePath)) {
  let content = fs.readFileSync(draftsServicePath, 'utf8');
  content = content.replace(/async getAvailableHubs\(user:\s*SessionPayload\)/g, 'async getAvailableHubs(user: SessionPayload, lat?: number, lng?: number)');
  fs.writeFileSync(draftsServicePath, content, 'utf8');
  console.log('[Fixed Signature] getAvailableHubs in parcel-drafts.service.ts');
}

console.log('Secure rewiring successfully applied!');
