/* screenings4u DOT Management Portal — standalone configuration */
(()=>{
  "use strict";
  const config=Object.freeze({
    portalName:"screenings4u DOT Management Portal",
    portalHost:"app.screenings4u.com",
    managedWebsite:"https://dot.screenings4u.com",
    supabaseUrl:"https://elpbnytpciqnbexiaebp.supabase.co",
    supabaseAnonKey:"sb_publishable_xVI6Mjkk1bNVMGHZCPuK6w_8FSHKdkC",
    staffContextFunction:"screenings4u-staff-context",
    roleContextFunction:"portal-access-context",
    /* Existing DOT-only backend adapter. Front-end files are completely separate from Enterprise. */
    managementFunction:"dot-enterprise-management",
    ctpaAdminFunction:"dot-ctpa-admin-data",
    controlRegistryFunction:"dot-control-registry",
    distributionFunction:"dot-distribution-management",
    configFunction:"dot-config-management",
    selectionFunction:"dot-selection-management",
    testingHandoffFunction:"dot-testing-handoff",
    inviteFunction:"dot-account-invite",
    provisioningFunction:"enterprise-account-provisioning",
    orderingFunction:"enterprise-account-ordering",
    adminOrderFunction:"dot-admin-order",
    pricingAdminFunction:"dot-ctpa-pricing-admin",
    planCatalogAdminFunction:"dot-plan-catalog-admin",
    demoManagementFunction:"dot-demo-management",
    storageKey:"s4u-dot-management-session"
  });
  window.DOT_PORTAL_CONFIG=config;
  if(window.supabase?.createClient){
    window.dotSupabase=window.supabase.createClient(config.supabaseUrl,config.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.sessionStorage,storageKey:config.storageKey}});
  } else console.error('[DOT Portal] Supabase JS is unavailable.');
})();
