import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Save, Bell, Globe, ShieldCheck, Smartphone, Download, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, getErrorMessage } from "@/lib/queryClient";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("general");
  const { toast } = useToast();
  
  // Mock settings state
  const [notifications, setNotifications] = useState({
    email: true,
    sms: false,
    push: true,
    alertsOnly: false
  });

  // Mobile app version state
  const { data: mobileVersion, refetch: refetchVersion } = useQuery<any>({
    queryKey: ["/api/mobile/version-check"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/mobile/version-check?platform=android");
      return res.json();
    }
  });

  const [versionForm, setVersionForm] = useState({
    versionName: "1.0.1",
    versionCode: 2,
    minVersionCode: 2,
    forceUpdate: true,
    releaseNotes: "Operational update: Live route segregation, automated duty hours, and Jasmis outlets."
  });

  useEffect(() => {
    if (mobileVersion) {
      setVersionForm({
        versionName: mobileVersion.latestVersionName || "1.0.1",
        versionCode: mobileVersion.latestVersionCode || 2,
        minVersionCode: mobileVersion.minVersionCode || 2,
        forceUpdate: mobileVersion.forceUpdate ?? true,
        releaseNotes: mobileVersion.releaseNotes || ""
      });
    }
  }, [mobileVersion]);

  const updateVersionMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest("POST", "/api/mobile/version-config", payload);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Mobile App Configuration Updated",
        description: "Drivers will now be prompted to update to this version on their next login."
      });
      refetchVersion();
    },
    onError: (err: any) => {
      toast({
        title: "Failed to update version settings",
        description: getErrorMessage(err),
        variant: "destructive"
      });
    }
  });

  const handleSave = () => {
    toast({
      title: "Settings Saved",
      description: "Your system configuration has been successfully updated.",
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <PageHeader 
        title="System Settings" 
        description="Configure notifications, regional formats, and global system preferences."
      >
        <Button onClick={handleSave} className="gap-2">
          <Save className="h-4 w-4" /> Save Changes
        </Button>
      </PageHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/60 p-1 border rounded-lg">
          <TabsTrigger value="general" className="px-4 py-2">General & Regional</TabsTrigger>
          <TabsTrigger value="notifications" className="px-4 py-2">Notifications</TabsTrigger>
          <TabsTrigger value="security" className="px-4 py-2">Security & Access</TabsTrigger>
          <TabsTrigger value="mobile" className="px-4 py-2 flex items-center gap-1.5">
            <Smartphone className="h-4 w-4" /> Driver App Updates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="m-0 space-y-6">
          <Card className="shadow-lg border-muted bg-card/60 backdrop-blur-md">
            <CardHeader className="pb-4 border-b">
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" /> Regional Formats
              </CardTitle>
              <CardDescription>Configure currency, timezone, and date formats across the ERP.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Base Currency</Label>
                <Select defaultValue="BHD">
                  <SelectTrigger>
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BHD">BHD - Bahraini Dinar</SelectItem>
                    <SelectItem value="AED">AED - UAE Dirham</SelectItem>
                    <SelectItem value="SAR">SAR - Saudi Riyal</SelectItem>
                    <SelectItem value="USD">USD - US Dollar</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Timezone</Label>
                <Select defaultValue="Asia/Muscat">
                  <SelectTrigger>
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Asia/Muscat">(GMT+4) Asia/Muscat</SelectItem>
                    <SelectItem value="Asia/Dubai">(GMT+4) Asia/Dubai</SelectItem>
                    <SelectItem value="Asia/Riyadh">(GMT+3) Asia/Riyadh</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Date Format</Label>
                <Select defaultValue="DD/MM/YYYY">
                  <SelectTrigger>
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                    <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                    <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>First Day of Week</Label>
                <Select defaultValue="sunday">
                  <SelectTrigger>
                    <SelectValue placeholder="Select day" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sunday">Sunday</SelectItem>
                    <SelectItem value="monday">Monday</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="m-0 space-y-6">
          <Card className="shadow-lg border-muted bg-card/60 backdrop-blur-md">
            <CardHeader className="pb-4 border-b">
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" /> Notification Preferences
              </CardTitle>
              <CardDescription>Manage how alerts are delivered to system administrators.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive daily digests and critical alerts via email.</p>
                </div>
                <Switch 
                  checked={notifications.email} 
                  onCheckedChange={(c) => setNotifications(prev => ({ ...prev, email: c }))} 
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">SMS Alerts</Label>
                  <p className="text-sm text-muted-foreground">Get instant SMS for delayed deliveries or driver issues.</p>
                </div>
                <Switch 
                  checked={notifications.sms} 
                  onCheckedChange={(c) => setNotifications(prev => ({ ...prev, sms: c }))} 
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">In-App Push</Label>
                  <p className="text-sm text-muted-foreground">Enable realtime browser notifications for new orders.</p>
                </div>
                <Switch 
                  checked={notifications.push} 
                  onCheckedChange={(c) => setNotifications(prev => ({ ...prev, push: c }))} 
                />
              </div>
              <div className="flex items-center justify-between border-t pt-6 mt-6">
                <div className="space-y-0.5">
                  <Label className="text-base text-amber-600">Critical Alerts Only</Label>
                  <p className="text-sm text-muted-foreground">Mute standard operational updates; receive only errors and SLA breaches.</p>
                </div>
                <Switch 
                  checked={notifications.alertsOnly} 
                  onCheckedChange={(c) => setNotifications(prev => ({ ...prev, alertsOnly: c }))} 
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="m-0 space-y-6">
          <Card className="shadow-lg border-muted bg-card/60 backdrop-blur-md">
            <CardHeader className="pb-4 border-b">
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" /> Zone-Based Access Control
              </CardTitle>
              <CardDescription>Configure strict data isolation for regional managers.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Enforce Zone Isolation</Label>
                  <p className="text-sm text-muted-foreground">Users can only see orders, vehicles, and drivers within their assigned zones.</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between border-t pt-6">
                <div className="space-y-0.5">
                  <Label className="text-base">Require Geo-Verification</Label>
                  <p className="text-sm text-muted-foreground">Mandate GPS tracking for driver attendance check-in.</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mobile" className="m-0 space-y-6">
          <Card className="shadow-lg border-muted bg-card/60 backdrop-blur-md">
            <CardHeader className="pb-4 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-primary" /> Driver Mobile App Updates & Version Enforcement
                </CardTitle>
                <CardDescription className="mt-1">
                  Enforce immediate app updates upon driver login to keep all handheld devices in operational sync.
                </CardDescription>
              </div>
              <a
                href="/api/mobile/download-apk"
                target="_blank"
                rel="noreferrer"
                download="ERP.apk"
              >
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" /> Download Latest APK
                </Button>
              </a>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {/* Status Banner */}
              <div className="p-4 bg-muted/40 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    v{versionForm.versionName}
                  </div>
                  <div>
                    <div className="font-semibold flex items-center gap-2">
                      Active Release: v{versionForm.versionName} (Build Code: {versionForm.versionCode})
                      {versionForm.forceUpdate && (
                        <Badge className="bg-emerald-600 hover:bg-emerald-700">Mandatory Auto-Update Active</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Drivers running build &lt; {versionForm.minVersionCode} will be prompted on login to download and install the new version.
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => refetchVersion()}
                  className="gap-1.5 text-xs"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh
                </Button>
              </div>

              {/* Form Grid */}
              <div className="grid gap-6 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Latest Version Display Name</Label>
                  <Input
                    value={versionForm.versionName}
                    onChange={(e) => setVersionForm(prev => ({ ...prev, versionName: e.target.value }))}
                    placeholder="e.g. 1.0.1"
                  />
                  <p className="text-xs text-muted-foreground">Version string shown to drivers in update dialog.</p>
                </div>

                <div className="space-y-2">
                  <Label>Target Version Code (Integer)</Label>
                  <Input
                    type="number"
                    value={versionForm.versionCode}
                    onChange={(e) => setVersionForm(prev => ({ ...prev, versionCode: parseInt(e.target.value) || 1 }))}
                    placeholder="2"
                  />
                  <p className="text-xs text-muted-foreground">Android internal build code (e.g. 2).</p>
                </div>

                <div className="space-y-2">
                  <Label>Minimum Required Version Code</Label>
                  <Input
                    type="number"
                    value={versionForm.minVersionCode}
                    onChange={(e) => setVersionForm(prev => ({ ...prev, minVersionCode: parseInt(e.target.value) || 1 }))}
                    placeholder="2"
                  />
                  <p className="text-xs text-muted-foreground">Devices below this code are blocked until updated.</p>
                </div>
              </div>

              <div className="flex items-center justify-between border-t pt-6">
                <div className="space-y-0.5">
                  <Label className="text-base">Force Update On Login</Label>
                  <p className="text-sm text-muted-foreground">
                    Block drivers with outdated app versions from proceeding until they tap update and install.
                  </p>
                </div>
                <Switch
                  checked={versionForm.forceUpdate}
                  onCheckedChange={(c) => setVersionForm(prev => ({ ...prev, forceUpdate: c }))}
                />
              </div>

              <div className="space-y-2 border-t pt-6">
                <Label>Release Notes & Operational Instructions</Label>
                <Textarea
                  value={versionForm.releaseNotes}
                  onChange={(e) => setVersionForm(prev => ({ ...prev, releaseNotes: e.target.value }))}
                  placeholder="Describe the operational changes or bug fixes in this release..."
                  className="min-h-[100px]"
                />
                <p className="text-xs text-muted-foreground">
                  Shown directly in the driver mobile popup when the update prompt appears.
                </p>
              </div>

              <div className="flex justify-end pt-4">
                <Button
                  onClick={() => updateVersionMutation.mutate(versionForm)}
                  disabled={updateVersionMutation.isPending}
                  className="gap-2"
                >
                  <Save className="h-4 w-4" />
                  {updateVersionMutation.isPending ? "Applying..." : "Save & Enforce Version"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
