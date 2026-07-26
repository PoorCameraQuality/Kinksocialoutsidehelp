SELECT mc.id AS case_id, mc.status, mc.queue, mc.policy_reason, mc.severity,
       ma.id AS asset_id, ma.upload_status, ma.scan_status, ma.content_rating,
       ma.source_surface, ma.original_filename,
       msr.scanner_name, msr.status AS scanner_status, msr.labels, msr.user_facing_summary
FROM moderation_cases mc
LEFT JOIN media_assets ma ON ma.moderation_case_id = mc.id OR ma.id = mc.target_content_id::uuid
LEFT JOIN media_scanner_results msr ON msr.media_asset_id = ma.id
WHERE mc.id = '9042a95b-b62b-49ea-a4e3-33fb730743a7'
ORDER BY msr.created_at;
