import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";

// --- Types ---

interface TripPreferences {
  days: number;
  golfers: number;
  startDate: string; // Replaces 'season' for dynamic date-based pricing
  region: string;
  golfBudget: 'Value' | 'Mid-Range' | 'Luxury';
  lodgingBudget: 'Casino/Value' | 'Condo/Mid-Range' | 'Resort/Luxury';
  diningPreference: 'Casual/Pub' | 'Mix' | 'Fine Dining';
  transportType: 'Self-Drive' | 'Private Shuttle/SUV' | 'Luxury Coach';
}

interface ItineraryDay {
  dayNumber: number;
  dateStr?: string; // e.g. "Friday, June 15"
  morningActivity: string; // Usually Golf
  morningActivityDesc: string; // Designer or feature
  morningActivityDesignerBio?: string; // Short bio of the designer
  morningActivityDifficulty?: string; // Easy, Medium, Hard
  morningActivityAmenities?: string[]; // Range, Putting Green, etc.
  afternoonActivity: string; // 2nd round or activity
  afternoonActivityDesc: string; // Details
  afternoonActivityDesignerBio?: string; // Short bio if it's a course
  afternoonActivityDifficulty?: string; // Easy, Medium, Hard (if golf)
  afternoonActivityAmenities?: string[]; // Range, Putting Green, etc.
  lodging: string;
  dining: string;
  travelNotes: string; // Distance matrix info
  travelDistanceMiles: number; // Added for precision
  travelTimeMinutes: number; // Total driving time estimate
  logisticsWarning?: string; // Warning if driving is extensive or logistics are tight
}

interface BudgetBreakdown {
  golfCost: number;
  lodgingCost: number;
  diningCost: number;
  transportCost: number; // Gas/Rental estimate
  totalPerPerson: number;
  currency: string;
  demandLevel: 'Low' | 'Moderate' | 'High' | 'Peak'; // Dynamic pricing factor
  pricingRationale: string; // Explanation of dynamic adjustment
}

interface WeatherInfo {
  summary: string;
  avgTemp: string;
  precipitationChance: string;
  recommendedGear: string[];
}

interface TripResult {
  title: string;
  summary: string;
  transportRecommendation: string; // Specific vehicle details
  itinerary: ItineraryDay[];
  budget: BudgetBreakdown;
  upsells: string[];
  weather: WeatherInfo;
  whyThisPlan: string;
  contactLink: string;
}

// --- Icons (using FontAwesome classes in HTML, but helper components here) ---

const Icon = ({ name, className = "" }: { name: string, className?: string }) => (
  <i className={`fas fa-${name} ${className}`}></i>
);

// --- Components ---

const Header = () => (
  <header className="bg-golf-green text-white shadow-lg sticky top-0 z-50">
    <div className="container mx-auto px-4 py-4 flex justify-between items-center">
      <div className="flex items-center space-x-3">
        <Icon name="mountain" className="text-2xl" />
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-wide">Golf the High Sierra</h1>
          <p className="text-xs text-green-200 uppercase tracking-widest">AI Trip Planner & Budget Estimator</p>
        </div>
      </div>
      <a href="https://golfthehighsierra.com" target="_blank" rel="noreferrer" className="hidden md:block text-sm hover:text-green-200 transition">
        golfthehighsierra.com
      </a>
    </div>
  </header>
);

const InputSlider = ({ label, value, min, max, onChange, unit = "" }: any) => (
  <div className="mb-4">
    <div className="flex justify-between mb-1">
      <span className="text-sm font-semibold text-gray-700">{label}</span>
      <span className="text-sm font-bold text-golf-green">{value} {unit}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-700"
    />
  </div>
);

const SelectButton = ({ options, selected, onChange, label }: any) => (
  <div className="mb-5">
    <span className="block text-sm font-semibold text-gray-700 mb-2">{label}</span>
    <div className="grid grid-cols-3 gap-2">
      {options.map((opt: string) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`py-2 px-1 text-xs md:text-sm rounded-md transition border ${
            selected === opt
              ? 'bg-golf-green text-white border-golf-green shadow-md'
              : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  </div>
);

const DifficultyBadge = ({ level }: { level?: string }) => {
  if (!level) return null;
  const normalized = level.toLowerCase();
  let colorClass = 'bg-gray-100 text-gray-800';
  
  if (normalized === 'easy') colorClass = 'bg-green-100 text-green-800 border border-green-200';
  if (normalized === 'medium') colorClass = 'bg-yellow-100 text-yellow-800 border border-yellow-200';
  if (normalized === 'hard') colorClass = 'bg-red-100 text-red-800 border border-red-200';

  return (
    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ml-2 align-middle ${colorClass}`}>
      {level}
    </span>
  );
};

const BookingModal = ({ course, day, golfers, onClose }: { course: string, day: number, golfers: number, onClose: () => void }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    notes: '',
    rentalClubs: false,
    transport: false
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(2);
    setTimeout(() => {
      onClose();
    }, 3000);
  };

  if (step === 2) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
        <div className="bg-white rounded-xl shadow-2xl p-8 max-w-sm w-full text-center animate-fade-in-up">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Icon name="check" className="text-3xl" />
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">Request Sent!</h3>
          <p className="text-gray-600 text-sm">Thanks, <span className="font-semibold">{formData.name}</span>. A GTHS concierge will contact you at {formData.email} shortly to finalize your tee time at {course}.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in-up transform transition-all my-8">
        <div className="bg-golf-green p-5 flex justify-between items-center text-white">
          <div>
            <h3 className="text-xl font-bold flex items-center">
              <Icon name="calendar-check" className="mr-2" /> Request Booking
            </h3>
            <p className="text-green-100 text-xs mt-1">Direct to GTHS Concierge</p>
          </div>
          <button onClick={onClose} className="hover:text-green-200 transition">
            <Icon name="times" className="text-2xl" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6">
          {/* Trip Summary Snippet */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 font-bold uppercase">Course / Activity</p>
              <p className="text-gray-900 font-bold text-lg"><Icon name="flag" className="text-green-600 mr-1"/> {course}</p>
              <p className="text-sm text-gray-600">Day {day} • {golfers} Golfers</p>
            </div>
            <div className="text-right">
               <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-2 py-1 rounded border border-yellow-200">
                 Waitlist / Request
               </span>
            </div>
          </div>

          <div className="space-y-4 mb-6">
            <h4 className="text-sm font-bold text-gray-700 border-b pb-2">Contact Details</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Full Name</label>
                <input required type="text" 
                  value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm" placeholder="Tiger Woods" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Phone</label>
                <input required type="tel" 
                   value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})}
                   className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm" placeholder="(555) 123-4567" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Email Address</label>
              <input required type="email" 
                  value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm" placeholder="you@example.com" />
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-2">
               <label className="flex items-center space-x-2 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input type="checkbox" className="accent-green-600 w-4 h-4" 
                    checked={formData.rentalClubs} onChange={e => setFormData({...formData, rentalClubs: e.target.checked})} />
                  <span className="text-sm text-gray-700">Need Rental Clubs</span>
               </label>
               <label className="flex items-center space-x-2 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input type="checkbox" className="accent-green-600 w-4 h-4" 
                     checked={formData.transport} onChange={e => setFormData({...formData, transport: e.target.checked})} />
                  <span className="text-sm text-gray-700">Quote Transport</span>
               </label>
            </div>

            <div>
               <label className="block text-xs font-semibold text-gray-600 mb-1">Special Requests / Notes</label>
               <textarea 
                  value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm h-20 resize-none" placeholder="Preferred tee time, dietary restrictions, etc." />
            </div>
          </div>

          <div className="flex space-x-3">
            <button type="button" onClick={onClose} className="flex-1 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition">
              Cancel
            </button>
            <button type="submit" className="flex-1 py-3 px-4 bg-golf-green text-white rounded-lg font-bold hover:bg-green-800 transition shadow-md flex justify-center items-center">
              Submit Request <Icon name="paper-plane" className="ml-2 text-xs" />
            </button>
          </div>
          <p className="text-[10px] text-gray-400 text-center mt-3">
            By submitting, you agree to have a GTHS representative contact you. No payment is processed now.
          </p>
        </form>
      </div>
    </div>
  );
};

const BudgetCard = ({ budget, golfers }: { budget: BudgetBreakdown, golfers: number }) => {
  const totalTrip = budget.totalPerPerson * golfers;
  const max = budget.totalPerPerson;
  const pGolf = (budget.golfCost / max) * 100;
  const pLodging = (budget.lodgingCost / max) * 100;
  const pDining = (budget.diningCost / max) * 100;
  const pTransport = (budget.transportCost / max) * 100;

  // Demand Level Styles
  let demandColor = "text-gray-600 bg-gray-100";
  let demandIcon = "minus";
  if (budget.demandLevel === 'High' || budget.demandLevel === 'Peak') {
    demandColor = "text-red-700 bg-red-100 border-red-200";
    demandIcon = "fire";
  } else if (budget.demandLevel === 'Moderate') {
    demandColor = "text-orange-700 bg-orange-100 border-orange-200";
    demandIcon = "chart-line";
  } else if (budget.demandLevel === 'Low') {
    demandColor = "text-green-700 bg-green-100 border-green-200";
    demandIcon = "tag";
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border-t-4 border-yellow-500 relative overflow-hidden">
      <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-bold text-gray-800 flex items-center">
            <Icon name="calculator" className="mr-2 text-yellow-500" />
            Dynamic Budget Est.
          </h3>
          <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded border flex items-center ${demandColor}`}>
             <Icon name={demandIcon} className="mr-1" /> {budget.demandLevel} Demand
          </span>
      </div>
      
      {budget.pricingRationale && (
          <div className="mb-4 bg-gray-50 border-l-2 border-gray-400 p-2">
            <p className="text-xs text-gray-600 italic">"{budget.pricingRationale}"</p>
          </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <div className="mb-4">
             <p className="text-sm text-gray-500">Est. Per Golfer</p>
             <div className="flex items-baseline">
                <p className="text-3xl font-bold text-gray-900">${budget.totalPerPerson.toLocaleString()}</p>
                {budget.demandLevel === 'Peak' && <span className="ml-2 text-xs font-bold text-red-500 animate-pulse">Dynamic Pricing Active</span>}
             </div>
          </div>
          <div className="mb-4">
             <p className="text-sm text-gray-500">Total Group ({golfers} pax)</p>
             <p className="text-xl font-semibold text-gray-700">${totalTrip.toLocaleString()}</p>
          </div>
          <p className="text-xs text-gray-400 italic">*Estimates based on real-time simulated availability. Prices subject to change.</p>
        </div>

        <div className="space-y-3">
            {/* Bars */}
            <div>
                <div className="flex justify-between text-xs mb-1">
                    <span>Golf & Activities</span>
                    <span>${budget.golfCost}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="bg-green-600 h-2 rounded-full" style={{ width: `${pGolf}%` }}></div>
                </div>
            </div>
            <div>
                <div className="flex justify-between text-xs mb-1">
                    <span>Lodging</span>
                    <span>${budget.lodgingCost}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${pLodging}%` }}></div>
                </div>
            </div>
            <div>
                <div className="flex justify-between text-xs mb-1">
                    <span>Dining</span>
                    <span>${budget.diningCost}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="bg-orange-500 h-2 rounded-full" style={{ width: `${pDining}%` }}></div>
                </div>
            </div>
             <div>
                <div className="flex justify-between text-xs mb-1">
                    <span>Transport</span>
                    <span>${budget.transportCost}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="bg-gray-400 h-2 rounded-full" style={{ width: `${pTransport}%` }}></div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

const TransportCard = ({ type, recommendation, cost }: { type: string, recommendation: string, cost: number }) => {
  return (
    <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 mb-6 shadow-sm">
        <h4 className="font-bold text-slate-800 mb-3 flex items-center text-lg">
            <Icon name="shuttle-van" className="mr-2 text-slate-600"/> Transport Logistics
        </h4>
        <div className="flex flex-col md:flex-row md:items-center justify-between">
            <div>
                <p className="text-sm font-semibold text-slate-700">{type}</p>
                <p className="text-xs text-slate-500 italic mt-1">{recommendation}</p>
            </div>
            <div className="mt-3 md:mt-0 text-right">
                <span className="bg-white text-slate-800 text-xs px-3 py-1 rounded border border-slate-300 font-mono">
                    ~${cost} / person
                </span>
            </div>
        </div>
    </div>
  );
}

const UpsellCard = ({ items }: { items: string[] }) => {
  if (!items || items.length === 0) return null;
  return (
    <div className="bg-amber-50 rounded-xl p-6 border border-amber-100 mb-6 shadow-sm">
      <h4 className="font-bold text-amber-900 mb-3 flex items-center text-lg">
        <Icon name="star" className="mr-2 text-amber-500"/> Premium Upgrades
      </h4>
      <ul className="space-y-3">
        {items.map((item, idx) => (
          <li key={idx} className="flex items-start text-sm text-amber-900">
             <Icon name="check-circle" className="mt-1 mr-2 text-amber-500 text-xs" />
             <span className="font-medium">{item}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-amber-700/60 mt-4 italic">Ask your concierge about adding these to your package.</p>
    </div>
  );
};

const AmenitiesList = ({ items }: { items?: string[] }) => {
  if (!items || items.length === 0) return null;
  return (
    <div className="ml-5 mt-2 flex flex-wrap gap-1.5">
      {items.map((item, idx) => (
        <span key={idx} className="text-[10px] text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-gray-100 flex items-center">
           <Icon name="check" className="text-[8px] mr-1 text-green-500" /> {item}
        </span>
      ))}
    </div>
  );
};

const CourseSpotlight = ({ courseName, bio, onBook }: { courseName: string, bio: string, onBook: () => void }) => {
    // Rotating generic golf images to prevent broken links while providing rich visual
    const images = [
        "https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1535131749006-b7f58c99034b?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1600607686527-6fb886090705?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1592919505780-303950717480?auto=format&fit=crop&w=800&q=80"
    ];
    // Pick an image deterministically based on course name length to keep it consistent
    const imgIndex = courseName.length % images.length;
    const selectedImage = images[imgIndex];
    
    // Generate Google Maps Search Link
    const mapLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(courseName + " Golf Course")}`;

    return (
        <div className="mt-3 mb-4 bg-gray-50 rounded-lg overflow-hidden border border-gray-200">
            <div className="h-32 w-full relative">
                <img src={selectedImage} alt="Golf Course" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-3">
                     <h5 className="text-white font-bold text-sm shadow-sm">{courseName}</h5>
                </div>
            </div>
            <div className="p-3">
                <div className="flex items-start">
                    <Icon name="pen-fancy" className="text-gray-400 text-xs mt-1 mr-2" />
                    <div>
                         <p className="text-xs text-gray-500 font-bold uppercase mb-1">Designer Bio</p>
                         <p className="text-xs text-gray-700 leading-relaxed italic">
                             {bio || "A premier course in the High Sierra region known for its challenging layout and stunning views."}
                         </p>
                    </div>
                </div>
                <div className="mt-3 flex space-x-2">
                    <a href={mapLink} target="_blank" rel="noreferrer" className="flex-1 bg-white border border-gray-300 text-gray-700 text-xs py-2 rounded text-center hover:bg-gray-50 transition font-semibold">
                        <Icon name="map-marker-alt" className="mr-1 text-red-500"/> View Map
                    </a>
                    <button 
                        onClick={onBook}
                        className="flex-1 bg-green-600 text-white text-xs py-2 rounded text-center hover:bg-green-700 transition font-bold shadow-sm"
                    >
                        <Icon name="calendar-plus" className="mr-1"/> Book Tee Time
                    </button>
                </div>
            </div>
        </div>
    );
}

const ItineraryCard = ({ day, onBook }: { day: ItineraryDay, onBook: (course: string, day: number) => void }) => (
  <div className="relative pl-8 pb-8 border-l-2 border-green-200 last:border-0 last:pb-0">
    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-golf-green border-2 border-white shadow-sm"></div>
    <div className="flex justify-between items-center mb-2">
        <div>
            <h4 className="text-lg font-bold text-gray-800">Day {day.dayNumber}</h4>
            {day.dateStr && <span className="text-xs text-gray-500 font-semibold">{day.dateStr}</span>}
        </div>
        {day.logisticsWarning && (
            <span className="text-[10px] bg-red-100 text-red-800 px-2 py-1 rounded-full font-bold border border-red-200 flex items-center">
                <Icon name="exclamation-triangle" className="mr-1" />
                Alert: {day.logisticsWarning}
            </span>
        )}
    </div>
    
    <div className={`bg-white rounded-lg p-4 shadow-sm border ${day.logisticsWarning ? 'border-red-200 ring-1 ring-red-100' : 'border-gray-100'} hover:shadow-md transition`}>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <div className="mb-3">
            <span className="text-xs font-bold text-green-600 uppercase tracking-wide">Morning Activity</span>
            
            <div className="mb-2">
                <div className="flex items-center flex-wrap gap-2 mb-1">
                    <p className="text-gray-900 font-medium"><Icon name="flag" className="mr-1 text-green-500"/> {day.morningActivity}</p>
                    <DifficultyBadge level={day.morningActivityDifficulty} />
                </div>
                
                {day.morningActivityDifficulty ? (
                    /* Show Rich Course Spotlight if it's a golf course */
                    <CourseSpotlight 
                        courseName={day.morningActivity}
                        bio={day.morningActivityDesignerBio || day.morningActivityDesc}
                        onBook={() => onBook(day.morningActivity, day.dayNumber)}
                    />
                ) : (
                    /* Show simple description if it's not golf */
                    day.morningActivityDesc && (
                        <p className="text-xs text-gray-500 ml-5 italic">{day.morningActivityDesc}</p>
                    )
                )}

                <AmenitiesList items={day.morningActivityAmenities} />
            </div>

            {day.afternoonActivity && (
                 <div className="mt-4 pt-4 border-t border-dashed border-gray-200">
                    <span className="text-xs font-bold text-orange-600 uppercase tracking-wide">Afternoon Activity</span>
                    <div className="flex items-center flex-wrap gap-2 mb-1 mt-1">
                        <p className="text-gray-800 text-sm font-medium"><Icon name="sun" className="mr-1 text-orange-400"/> {day.afternoonActivity}</p>
                        <DifficultyBadge level={day.afternoonActivityDifficulty} />
                    </div>
                    
                    {day.afternoonActivityDifficulty ? (
                        <CourseSpotlight 
                            courseName={day.afternoonActivity}
                            bio={day.afternoonActivityDesignerBio || day.afternoonActivityDesc}
                            onBook={() => onBook(day.afternoonActivity, day.dayNumber)}
                        />
                    ) : (
                        day.afternoonActivityDesc && (
                            <p className="text-xs text-gray-500 ml-5 italic">{day.afternoonActivityDesc}</p>
                        )
                    )}

                    <AmenitiesList items={day.afternoonActivityAmenities} />
                 </div>
            )}
          </div>
          <div className="mt-4">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wide">Stay</span>
            <p className="text-gray-900 font-medium"><Icon name="bed" className="mr-1 text-blue-500"/> {day.lodging}</p>
          </div>
        </div>
        
        <div className="md:border-l md:pl-4 border-gray-100">
           <div className="mb-3">
            <span className="text-xs font-bold text-orange-600 uppercase tracking-wide">Dining</span>
            <p className="text-gray-900 text-sm"><Icon name="utensils" className="mr-1 text-orange-400"/> {day.dining}</p>
          </div>
          <div>
             <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Travel Details</span>
             <p className="text-gray-600 text-xs mt-1"><Icon name="route" className="mr-1"/> {day.travelNotes}</p>
             <div className="flex items-center space-x-3 mt-1">
                {day.travelTimeMinutes > 0 && (
                     <span className={`text-xs font-bold flex items-center ${day.travelTimeMinutes > 50 ? 'text-red-600' : 'text-gray-600'}`}>
                        <Icon name="clock" className="mr-1"/> 
                        {Math.floor(day.travelTimeMinutes / 60) > 0 ? `${Math.floor(day.travelTimeMinutes / 60)}h ` : ''}{day.travelTimeMinutes % 60}m
                     </span>
                )}
                {day.travelDistanceMiles > 0 && (
                     <span className="text-xs text-gray-500 flex items-center">
                        <Icon name="road" className="mr-1"/> 
                        {day.travelDistanceMiles} mi
                     </span>
                )}
             </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

// --- Main App ---

const App = () => {
  const [preferences, setPreferences] = useState<TripPreferences>({
    days: 3,
    golfers: 4,
    startDate: "2025-06-19", // Default to a Thursday in June next year
    region: 'Mixed (Reno/Tahoe/Graeagle)',
    golfBudget: 'Mid-Range',
    lodgingBudget: 'Condo/Mid-Range',
    diningPreference: 'Mix',
    transportType: 'Self-Drive',
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TripResult | null>(null);
  const [bookingModal, setBookingModal] = useState<{course: string, day: number} | null>(null);

  const getTripDetails = (startDate: string, days: number) => {
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(start.getDate() + days - 1);
    
    // Get day names
    const dayNames = [];
    let currentDate = new Date(start);
    let hasWeekend = false;
    for (let i = 0; i < days; i++) {
        const day = currentDate.getDay();
        const name = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
        dayNames.push(name);
        if (day === 5 || day === 6 || day === 0) hasWeekend = true; // Fri, Sat, Sun
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return {
        range: `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} to ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        dayNames: dayNames,
        hasWeekend: hasWeekend
    };
  };

  const generateItinerary = async () => {
    setLoading(true);
    setResult(null);

    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      alert("API Key missing.");
      setLoading(false);
      return;
    }

    const ai = new GoogleGenAI({ apiKey });
    
    const tripDetails = getTripDetails(preferences.startDate, preferences.days);

    const prompt = `
      Create a detailed stay-and-play golf itinerary for the High Sierra region (Reno, Tahoe, Truckee, Graeagle).
      
      User Preferences:
      - Duration: ${preferences.days} days
      - Group Size: ${preferences.golfers} golfers
      - Start Date: ${preferences.startDate} (${tripDetails.dayNames[0]})
      - Specific Dates: ${tripDetails.range}
      - Region Preference: ${preferences.region}
      - Golf Budget Tier: ${preferences.golfBudget}
      - Lodging Budget Tier: ${preferences.lodgingBudget}
      - Dining Style: ${preferences.diningPreference}
      - Transport Preference: ${preferences.transportType}

      Constraints & Data Source:
      - **CRITICAL**: Use ONLY real, existing golf courses and hotels that are part of the Golf the High Sierra network/region.
      - **SCOPE**: Golf the High Sierra (GTHS) is the central booking agency for 50+ courses in Nevada and the Graeagle region.
      
      **OFFICIAL PARTNER NETWORK (50+ COURSES & PROPERTIES):**
      
      **GRAEAGLE REGION (via affiliate golfgraeagle.com):**
      - **Golf Courses**: The Dragon at Nakoma, Whitehawk Ranch, Grizzly Ranch, Plumas Pines, Graeagle Meadows.
      - **Lodging**: The Villas at Nakoma, The Lodge at Nakoma, Graeagle Meadows Condos, River Pines Resort, Plumas Pines Vacation Homes.
      - *Important*: For Graeagle itineraries, strictly use these properties. GTHS manages these bookings comprehensively.

      **NEVADA & TAHOE REGION (GTHS Direct):**
      - **Reno/Sparks Golf**: Lakeridge, Wolf Run, Toiyabe, Red Hawk (Lakes & Hills), Somersett, Washoe, Wildcreek, Sierra Sage, D'Andrea (if active).
      - **Carson Valley Golf**: Genoa Lakes (Lakes & Ranch), Dayton Valley, Sunridge, Silver Oak, Eagle Valley (East/West).
      - **Tahoe/Truckee Golf**: Coyote Moon, Old Greenwood, Gray's Crossing, Tahoe Donner, Incline Village (Championship & Mountain), Edgewood Tahoe, The Links at Squaw Creek.
      - **Lodging Partners**: The Row (Eldorado, Silver Legacy, Circus Circus), Peppermill Reno, Atlantis Casino, Grand Sierra Resort, Hyatt Regency Incline, Edgewood Lodge.
      
      **DYNAMIC PRICING ENGINE (SIMULATION)**:
      - Act as a real-time booking engine.
      - **Date Context**: The trip is ${tripDetails.range}. The days are: ${tripDetails.dayNames.join(', ')}.
      - **Weekend Surcharge**: If the itinerary includes Friday, Saturday, or Sunday:
        - Increase Golf costs by 20-30% for those days.
        - Increase Lodging costs by 30-50% for those nights.
      - **Demand Factor**:
        - If dates are in July or August -> 'Peak' Demand (Highest Prices).
        - If dates are May/Sept/Oct -> 'Moderate' Demand.
        - If dates include holidays (July 4, Labor Day) -> 'Peak' Demand + 20% Holiday Surcharge.
      - **Output**: Calculate total estimated cost precisely based on these dynamic factors.
      
      **TRANSPORT PARTNERS & LOGISTICS**:
      - GTHS offers full transportation packages.
      - **Vehicles based on group size**:
          - 4-6 pax: Luxury SUV (Suburban/Yukon/Escalade).
          - 8-12 pax: Mercedes Sprinter Van (High roof, luxury seating).
          - 16-24 pax: Mini-Coach / Executive Shuttle.
          - 30+ pax: Full Size Motorcoach.
      - **Budget Calculation**:
        - If 'Self-Drive': Estimate rental car + fuel.
        - If 'Private Shuttle/SUV': Estimate daily driver + vehicle rate (approx $800-$1500/day depending on size).
        - If 'Luxury Coach': Estimate charter rate (approx $1800-$2500/day).

      **LOGISTICS RULE (VERY IMPORTANT)**: 
      - Distances in the Sierra are significant. Minimize driving time for the customer.
      - **Clustering**: If staying in Reno, play Reno/Carson courses. If staying in Graeagle, play Graeagle courses. If staying in Tahoe, play Tahoe/Truckee courses.
      - **Drive Times**: 
          - Reno to Graeagle: ~60 mins (50 miles). 
          - Reno to North Tahoe/Truckee: ~45-50 mins (35 miles).
          - Reno to South Tahoe: ~75-90 mins (55 miles, mountain roads).
          - Graeagle to Truckee: ~50 mins (45 miles).
      - **Dining**: Schedule dinner CLOSE to where they are sleeping that night. Do not put a South Lake Tahoe dinner if they are sleeping in Reno.
      - If a day involves > 60 mins of total driving (excluding round trip to local course), explicitly mark it with a warning.
      - Avoid "ping-ponging" between regions (e.g., Reno -> Tahoe -> Reno -> Tahoe). Do one region, then transfer, then the next.

      - **PRICING RULE**: Use realistic, standard public rack rates adjusted by the Dynamic Pricing Engine above.
      - **URL RULE**: Do not output URLs.
      - Course Details: Include designer name and a short bio/history of the designer (1-2 sentences).
      - Course Amenities: List specific amenities such as Driving Range, Putting Green, Clubhouse, Pro Shop, Restaurant/Bar, GPS Carts. Only include if verified.
      - Course Difficulty: Rate 'Easy', 'Medium', or 'Hard'.
      - Weather: Provide specific details for the Month of the trip in ${preferences.region}.
      - Upsells: Provide 3-5 specific suggestions for premium lodging, dining, or activities.

      Output Requirement:
      Return JSON only matching this schema.
    `;

    try {
      // Retry wrapper for 429 Errors
      const generateWithRetry = async (retryCount = 0, maxRetries = 5): Promise<any> => {
        try {
           return await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
              temperature: 0.2,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  summary: { type: Type.STRING },
                  transportRecommendation: { type: Type.STRING, description: "Specific vehicle recommendation based on group size (e.g. 'Mercedes Sprinter Van (12 pax)')"},
                  itinerary: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        dayNumber: { type: Type.INTEGER },
                        dateStr: { type: Type.STRING, description: "e.g. Friday, June 19" },
                        morningActivity: { type: Type.STRING, description: "Primary golf round" },
                        morningActivityDesc: { type: Type.STRING, description: "Designer/Feature" },
                        morningActivityDesignerBio: { type: Type.STRING, description: "Short bio of the course designer" },
                        morningActivityDifficulty: { type: Type.STRING },
                        morningActivityAmenities: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of amenities (Driving Range, Club House, etc)" },
                        afternoonActivity: { type: Type.STRING },
                        afternoonActivityDesc: { type: Type.STRING },
                        afternoonActivityDesignerBio: { type: Type.STRING, description: "Short bio of the course designer" },
                        afternoonActivityDifficulty: { type: Type.STRING },
                        afternoonActivityAmenities: { type: Type.ARRAY, items: { type: Type.STRING } },
                        lodging: { type: Type.STRING },
                        dining: { type: Type.STRING },
                        travelNotes: { type: Type.STRING, description: "Route description" },
                        travelDistanceMiles: { type: Type.INTEGER, description: "Approximate miles driven this day" },
                        travelTimeMinutes: { type: Type.INTEGER, description: "Total estimated driving minutes for the day" },
                        logisticsWarning: { type: Type.STRING, description: "Warning if travel > 50 mins or logistics are tight. Null if practical." }
                      }
                    }
                  },
                  budget: {
                    type: Type.OBJECT,
                    properties: {
                      golfCost: { type: Type.NUMBER },
                      lodgingCost: { type: Type.NUMBER },
                      diningCost: { type: Type.NUMBER },
                      transportCost: { type: Type.NUMBER },
                      totalPerPerson: { type: Type.NUMBER },
                      currency: { type: Type.STRING },
                      demandLevel: { type: Type.STRING, enum: ['Low', 'Moderate', 'High', 'Peak'] },
                      pricingRationale: { type: Type.STRING, description: "Explanation of why prices are high/low (e.g. 'Weekend rates applied')" }
                    }
                  },
                  upsells: { type: Type.ARRAY, items: { type: Type.STRING } },
                  weather: {
                    type: Type.OBJECT,
                    properties: {
                      summary: { type: Type.STRING },
                      avgTemp: { type: Type.STRING },
                      precipitationChance: { type: Type.STRING },
                      recommendedGear: { type: Type.ARRAY, items: { type: Type.STRING } }
                    }
                  },
                  whyThisPlan: { type: Type.STRING },
                  contactLink: { type: Type.STRING },
                }
              }
            }
          });
        } catch (error: any) {
            // Check for 429 (Resource Exhausted) error code in various locations on error object
            const isQuotaError = 
                error.status === 429 || 
                error.code === 429 || 
                error.error?.code === 429 || 
                (error.response && error.response.status === 429) ||
                (error.message && (
                    error.message.includes('429') || 
                    error.message.toLowerCase().includes('quota') || 
                    error.message.toLowerCase().includes('exhausted')
                )) ||
                (error.statusText && error.statusText.includes('Exhausted'));
            
            if (isQuotaError && retryCount < maxRetries) {
                // Exponential backoff: 2s, 4s, 8s, 16s, 32s
                const delay = Math.pow(2, retryCount + 1) * 1000 + (Math.random() * 500); 
                console.warn(`Quota limit hit (Attempt ${retryCount + 1}). Retrying in ${Math.round(delay)}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return generateWithRetry(retryCount + 1, maxRetries);
            }
            throw error;
        }
      }

      const response = await generateWithRetry();

      const text = response.text;
      if (text) {
        const data = JSON.parse(text) as TripResult;
        data.contactLink = "https://golfthehighsierra.com/contact-custom-golf-package/";
        setResult(data);
      }
    } catch (e: any) {
      console.error(e);
      // Specific user feedback for 429
      if (e.status === 429 || e.code === 429 || (e.message && e.message.includes('429')) || (e.message && e.message.toLowerCase().includes('quota'))) {
        alert("We are experiencing unusually high traffic which exceeded our API quota. Please wait a minute and try again.");
      } else {
        alert("Failed to generate itinerary. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pb-10">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-12 gap-8">
          
          {/* Left Panel: Controls */}
          <div className="lg:col-span-4 xl:col-span-3">
            <div className="bg-white rounded-xl shadow-md p-6 sticky top-24">
              <h2 className="text-xl font-bold text-gray-800 mb-6 border-b pb-2">Plan Your Trip</h2>
              
              <InputSlider 
                label="Days" 
                value={preferences.days} 
                min={2} max={7} 
                onChange={(v: number) => setPreferences(prev => ({ ...prev, days: v }))} 
              />
              
              <InputSlider 
                label="Golfers" 
                value={preferences.golfers} 
                min={1} max={32} 
                onChange={(v: number) => setPreferences(prev => ({ ...prev, golfers: v }))} 
              />

              <div className="mb-4">
                 <label className="block text-sm font-semibold text-gray-700 mb-2">Region</label>
                 <select 
                    className="w-full p-2 border border-gray-300 rounded-md text-sm bg-white"
                    value={preferences.region}
                    onChange={(e) => setPreferences(prev => ({...prev, region: e.target.value}))}
                 >
                    <option>Reno Only</option>
                    <option>Tahoe Only</option>
                    <option>Graeagle Only</option>
                    <option>Mixed (Reno/Tahoe/Graeagle)</option>
                 </select>
              </div>

               <div className="mb-6">
                 <label className="block text-sm font-semibold text-gray-700 mb-2">Start Date</label>
                 <input 
                    type="date"
                    className="w-full p-2 border border-gray-300 rounded-md text-sm bg-white"
                    value={preferences.startDate}
                    onChange={(e) => setPreferences(prev => ({...prev, startDate: e.target.value}))}
                 />
                 <p className="text-[10px] text-gray-500 mt-1 italic">Pricing adjusts for weekends & holidays.</p>
              </div>

              <div className="h-px bg-gray-200 my-6"></div>
              
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Budget & Style</h3>

              <SelectButton 
                label="Golf Tier"
                options={['Value', 'Mid-Range', 'Luxury']}
                selected={preferences.golfBudget}
                onChange={(v: any) => setPreferences(prev => ({ ...prev, golfBudget: v }))}
              />

              <SelectButton 
                label="Lodging"
                options={['Casino/Value', 'Condo/Mid-Range', 'Resort/Luxury']}
                selected={preferences.lodgingBudget}
                onChange={(v: any) => setPreferences(prev => ({ ...prev, lodgingBudget: v }))}
              />
              
               <SelectButton 
                label="Dining"
                options={['Casual/Pub', 'Mix', 'Fine Dining']}
                selected={preferences.diningPreference}
                onChange={(v: any) => setPreferences(prev => ({ ...prev, diningPreference: v }))}
              />

              <SelectButton 
                label="Transport"
                options={['Self-Drive', 'Private Shuttle/SUV', 'Luxury Coach']}
                selected={preferences.transportType}
                onChange={(v: any) => setPreferences(prev => ({ ...prev, transportType: v }))}
              />

              <button
                onClick={generateItinerary}
                disabled={loading}
                className={`w-full py-4 rounded-lg font-bold text-lg shadow-lg transform transition hover:-translate-y-1 ${
                  loading 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-golf-green text-white hover:bg-green-800'
                }`}
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <Icon name="spinner" className="fa-spin mr-2"/> Checking Rates...
                  </span>
                ) : (
                  'Build My Trip'
                )}
              </button>
            </div>
          </div>

          {/* Right Panel: Results */}
          <div className="lg:col-span-8 xl:col-span-9">
            {!result && !loading && (
              <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 min-h-[400px]">
                <Icon name="map-marked-alt" className="text-6xl text-gray-300 mb-4" />
                <h3 className="text-2xl font-serif text-gray-400">Your Perfect Round Awaits</h3>
                <p className="max-w-md mt-2">Configure your preferences and dates on the left. We'll simulate live availability to build your custom itinerary.</p>
              </div>
            )}

            {loading && (
               <div className="flex flex-col items-center justify-center h-full text-center min-h-[400px] animate-pulse">
                <div className="text-6xl text-golf-green mb-4">
                    <i className="fas fa-golf-ball fa-spin"></i>
                </div>
                <h3 className="text-2xl font-serif text-gray-700">Checking Live Availability...</h3>
                <p className="text-gray-500 mt-2">Calculating dynamic weekend rates... Matching inventory...</p>
              </div>
            )}

            {result && (
              <div className="animate-fade-in-up">
                
                <div className="mb-8">
                  <h2 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 mb-2">{result.title}</h2>
                  <p className="text-lg text-gray-600 leading-relaxed">{result.summary}</p>
                </div>

                <div className="grid lg:grid-cols-2 gap-8 mb-8">
                    {/* Budget & Info Section */}
                    <div className="lg:col-span-1">
                        <BudgetCard budget={result.budget} golfers={preferences.golfers} />
                        
                        <TransportCard 
                          type={preferences.transportType} 
                          recommendation={result.transportRecommendation} 
                          cost={result.budget.transportCost}
                        />

                        <div className="bg-blue-50 rounded-xl p-6 border border-blue-100 mb-6">
                            <h4 className="font-bold text-blue-900 mb-3 flex items-center">
                                <Icon name="cloud-sun" className="mr-2"/> Weather Forecast
                            </h4>
                            <p className="text-sm text-blue-800 mb-4 italic">{result.weather.summary}</p>
                            
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="flex items-center">
                                    <Icon name="temperature-high" className="text-blue-500 mr-2" />
                                    <div>
                                        <span className="text-xs text-blue-600 font-semibold block">Temp</span>
                                        <span className="text-sm text-gray-700">{result.weather.avgTemp}</span>
                                    </div>
                                </div>
                                <div className="flex items-center">
                                    <Icon name="umbrella" className="text-blue-500 mr-2" />
                                    <div>
                                        <span className="text-xs text-blue-600 font-semibold block">Precipitation</span>
                                        <span className="text-sm text-gray-700">{result.weather.precipitationChance}</span>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <span className="text-xs text-blue-600 font-semibold block mb-1">Recommended Gear</span>
                                <div className="flex flex-wrap gap-2">
                                    {result.weather.recommendedGear.map((gear, idx) => (
                                        <span key={idx} className="bg-white text-blue-800 text-xs px-2 py-1 rounded border border-blue-200">
                                            {gear}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <UpsellCard items={result.upsells} />

                         <div className="bg-purple-50 rounded-xl p-6 border border-purple-100">
                            <h4 className="font-bold text-purple-900 mb-2"><Icon name="gem" className="mr-2"/>Why this plan?</h4>
                            <p className="text-sm text-purple-800">{result.whyThisPlan}</p>
                        </div>
                    </div>

                    {/* Itinerary Timeline */}
                    <div className="lg:col-span-1">
                         <div className="bg-white rounded-xl shadow-lg p-6">
                            <h3 className="text-xl font-bold text-gray-800 mb-6 border-b pb-4">Itinerary</h3>
                            <div className="space-y-0">
                                {result.itinerary.map((day) => (
                                    <ItineraryCard 
                                      key={day.dayNumber} 
                                      day={day} 
                                      onBook={(course, dayNum) => setBookingModal({course, day: dayNum})}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Upsells & CTA */}
                <div className="bg-gray-800 text-white rounded-xl shadow-xl p-8 text-center relative overflow-hidden">
                    <div className="relative z-10">
                        <h3 className="text-2xl font-serif mb-4">Ready to Book?</h3>
                        
                        <p className="mb-6 text-gray-300">Like this itinerary? Let our local experts book it for you with preferred tee times and rates.</p>
                        
                        <a 
                            href={result.contactLink}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-block bg-yellow-500 text-gray-900 font-bold py-3 px-8 rounded-full hover:bg-yellow-400 transition transform hover:scale-105"
                        >
                            Request Custom Quote
                        </a>
                    </div>
                    {/* Background decoration */}
                    <Icon name="tree" className="absolute -bottom-10 -left-10 text-9xl text-gray-700 opacity-20" />
                    <Icon name="mountain" className="absolute -top-10 -right-10 text-9xl text-gray-700 opacity-20" />
                </div>

              </div>
            )}
          </div>
        </div>
      </main>

      {/* Booking Modal */}
      {bookingModal && (
        <BookingModal 
          course={bookingModal.course} 
          day={bookingModal.day} 
          golfers={preferences.golfers}
          onClose={() => setBookingModal(null)} 
        />
      )}
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);