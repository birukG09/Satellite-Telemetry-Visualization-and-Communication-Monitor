import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type Satellite, type SatelliteFilter } from "@shared/schema";

interface FilterSidebarProps {
  filter: SatelliteFilter;
  onFilterChange: (filter: SatelliteFilter) => void;
  satellites: Satellite[];
  isLoading: boolean;
}

export default function FilterSidebar({ filter, onFilterChange, satellites, isLoading }: FilterSidebarProps) {
  const [searchInput, setSearchInput] = useState(filter.search || "");

  // Get unique satellite types and countries from current data
  const satelliteTypes = Array.from(new Set((satellites || []).map(sat => sat.type)));
  const countries = Array.from(new Set((satellites || []).map(sat => sat.country)));

  // Count satellites by type
  const typeCounts = (satellites || []).reduce((acc, sat) => {
    acc[sat.type] = (acc[sat.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Count satellites by orbit class
  const orbitCounts = (satellites || []).reduce((acc, sat) => {
    acc[sat.orbitClass] = (acc[sat.orbitClass] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    onFilterChange({ ...filter, search: value || undefined });
  };

  const handleTypeChange = (type: string, checked: boolean) => {
    const currentTypes = filter.types || [];
    const newTypes = checked 
      ? [...currentTypes, type]
      : currentTypes.filter(t => t !== type);
    
    onFilterChange({ 
      ...filter, 
      types: newTypes.length > 0 ? newTypes : undefined 
    });
  };

  const handleOrbitChange = (orbitClass: string) => {
    onFilterChange({ 
      ...filter, 
      orbitClass: orbitClass as 'ALL' | 'LEO' | 'MEO' | 'GEO'
    });
  };

  const handleCountryChange = (country: string) => {
    onFilterChange({ 
      ...filter, 
      country: country === 'all' ? undefined : country 
    });
  };

  const activeSatellites = (satellites || []).length;
  const leoCount = orbitCounts['LEO'] || 0;
  const avgAltitude = (satellites || []).length > 0 
    ? Math.round((satellites || []).reduce((sum, sat) => sum + 550, 0) / (satellites || []).length) // Approximate LEO altitude
    : 0;

  return (
    <aside className="w-80 cyber-panel p-4 m-2 mr-1">
      <div className="space-y-4">
        {/* Search */}
        <div>
          <Label className="block text-sm font-semibold mb-2 text-cyber-green">
            <i className="fas fa-search mr-2"></i>SEARCH SATELLITE
          </Label>
          <Input 
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Name or NORAD ID..."
            className="w-full bg-cyber-black border-cyber-border text-cyber-green focus:border-cyber-green focus:shadow-[0_0_10px_rgba(0,255,0,0.5)]"
          />
        </div>
        
        {/* Satellite Type Filter */}
        <div>
          <Label className="block text-sm font-semibold mb-2 text-cyber-green">
            <i className="fas fa-filter mr-2"></i>SATELLITE TYPE
          </Label>
          <div className="space-y-2">
            {satelliteTypes.map(type => (
              <div key={type} className="flex items-center space-x-2">
                <Checkbox 
                  id={`type-${type}`}
                  checked={filter.types?.includes(type) || false}
                  onCheckedChange={(checked) => handleTypeChange(type, checked as boolean)}
                  className="border-cyber-green data-[state=checked]:bg-cyber-green"
                />
                <Label 
                  htmlFor={`type-${type}`}
                  className="cursor-pointer hover:text-cyber-lime transition-colors text-cyber-green"
                >
                  {type}
                  <span className="text-xs text-cyber-green-dark ml-2">
                    ({typeCounts[type] || 0})
                  </span>
                </Label>
              </div>
            ))}
          </div>
        </div>
        
        {/* Orbit Class Filter */}
        <div>
          <Label className="block text-sm font-semibold mb-2 text-cyber-green">
            <i className="fas fa-circle-notch mr-2"></i>ORBIT CLASS
          </Label>
          <RadioGroup 
            value={filter.orbitClass || 'ALL'} 
            onValueChange={handleOrbitChange}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="ALL" id="orbit-all" className="border-cyber-green text-cyber-green" />
              <Label htmlFor="orbit-all" className="cursor-pointer hover:text-cyber-lime transition-colors text-cyber-green">
                All Orbits
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="LEO" id="orbit-leo" className="border-cyber-green text-cyber-green" />
              <Label htmlFor="orbit-leo" className="cursor-pointer hover:text-cyber-lime transition-colors text-cyber-green">
                LEO (Low Earth)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="MEO" id="orbit-meo" className="border-cyber-green text-cyber-green" />
              <Label htmlFor="orbit-meo" className="cursor-pointer hover:text-cyber-lime transition-colors text-cyber-green">
                MEO (Medium Earth)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="GEO" id="orbit-geo" className="border-cyber-green text-cyber-green" />
              <Label htmlFor="orbit-geo" className="cursor-pointer hover:text-cyber-lime transition-colors text-cyber-green">
                GEO (Geostationary)
              </Label>
            </div>
          </RadioGroup>
        </div>
        
        {/* Country Filter */}
        <div>
          <Label className="block text-sm font-semibold mb-2 text-cyber-green">
            <i className="fas fa-flag mr-2"></i>COUNTRY
          </Label>
          <Select value={filter.country || 'all'} onValueChange={handleCountryChange}>
            <SelectTrigger className="w-full bg-cyber-black border-cyber-border text-cyber-green focus:border-cyber-green">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-cyber-black border-cyber-border">
              <SelectItem value="all" className="text-cyber-green hover:bg-cyber-green hover:text-cyber-black">
                All Countries
              </SelectItem>
              {countries.map(country => (
                <SelectItem 
                  key={country} 
                  value={country}
                  className="text-cyber-green hover:bg-cyber-green hover:text-cyber-black"
                >
                  {country}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Quick Stats */}
        <div className="border-t border-cyber-border pt-4">
          <h3 className="text-sm font-semibold mb-2 text-cyber-green">
            <i className="fas fa-chart-bar mr-2"></i>QUICK STATS
          </h3>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-cyber-green-dark">Active Satellites:</span>
              <span className="text-cyber-lime">{activeSatellites}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-cyber-green-dark">LEO Satellites:</span>
              <span className="text-cyber-lime">{leoCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-cyber-green-dark">Average Altitude:</span>
              <span className="text-cyber-lime">{avgAltitude} km</span>
            </div>
            <div className="flex justify-between">
              <span className="text-cyber-green-dark">Update Status:</span>
              <span className="text-cyber-lime">{isLoading ? 'Loading...' : 'Live'}</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
