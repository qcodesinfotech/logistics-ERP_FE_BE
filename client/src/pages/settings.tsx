import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Save, Bell, Globe, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

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
                <Select defaultValue="OMR">
                  <SelectTrigger>
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OMR">OMR - Omani Rial</SelectItem>
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
      </Tabs>
    </div>
  );
}
