// --- DATA URLS ---
export const DATA_URLS = {
    csv: 'https://gist.githubusercontent.com/jstart/5957b92d8d1f60480de2d15654c555ca/raw/c66ae13821921707b79a0665b6acb02d7734ae85/torrance_precincts.csv',
    geojson: 'https://gist.githubusercontent.com/jstart/0ba13db4475880d226b4e222a09bdfc8/raw/2e72a76fe9ac3cf6ae036c1977d5803cb9693a6e/test.geojson',
    fullData: './Precinct_ACS_FullOverlay_final.json', // Using compact JSON format to avoid parsing issues
    variableLabels: 'https://raw.githubusercontent.com/jstart/jstart.github.io/refs/heads/master/acs_variable_labels.csv'
};

// --- CENSUS DATA CHUNKS DEFINITION (UPDATED FOR JSON FIELD NAMES) ---
export const CENSUS_DATA_CHUNKS = {
    'Renter': { name: 'Housing: Renter Status', vars: ['Percent!!HOUSING TENURE!!Occupied housing units!!Renter-occupied'] },
    'Employment': { name: 'Employment & Work', vars: ['Percent!!EMPLOYMENT STATUS!!Civilian labor force!!Unemployment Rate', 'Percent!!COMMUTING TO WORK!!Workers 16 years and over!!Worked from home', 'Percent!!CLASS OF WORKER!!Civilian employed population 16 years and over!!Government workers', 'Percent!!CLASS OF WORKER!!Civilian employed population 16 years and over!!Self-employed in own not incorporated business workers', 'Percent!!COMMUTING TO WORK!!Workers 16 years and over!!Car, truck, or van -- drove alone', 'Percent!!COMMUTING TO WORK!!Workers 16 years and over!!Public transportation (excluding taxicab)', 'Estimate!!COMMUTING TO WORK!!Workers 16 years and over!!Mean travel time to work (minutes)'] },
    'Income': { name: 'Income & Economic Status', vars: ['Estimate!!INCOME AND BENEFITS (IN 2022 INFLATION-ADJUSTED DOLLARS)!!Total households!!Median household income (dollars)', 'Estimate!!INCOME AND BENEFITS (IN 2022 INFLATION-ADJUSTED DOLLARS)!!Per capita income (dollars)', 'Percent!!INCOME AND BENEFITS (IN 2022 INFLATION-ADJUSTED DOLLARS)!!Total households!!$100,000 to $149,999', 'Percent!!INCOME AND BENEFITS (IN 2022 INFLATION-ADJUSTED DOLLARS)!!Total households!!With Food Stamp/SNAP benefits in the past 12 months'] },
    'Education': { name: 'Educational Attainment', vars: ['Percent!!EDUCATIONAL ATTAINMENT!!Population 25 years and over!!High school graduate or higher', "Percent!!EDUCATIONAL ATTAINMENT!!Population 25 years and over!!Bachelor's degree or higher", 'Percent!!EDUCATIONAL ATTAINMENT!!Population 25 years and over!!Graduate or professional degree'] },
    'Demographics': { name: 'Demographics & Diversity', vars: ['Percent!!PLACE OF BIRTH!!Total population!!Foreign born', 'Percent!!LANGUAGE SPOKEN AT HOME!!Population 5 years and over!!Language other than English', 'Percent!!LANGUAGE SPOKEN AT HOME!!Population 5 years and over!!Spanish'] },
    'HealthInsurance': { name: 'Health Insurance Coverage', vars: ['Percent!!HEALTH INSURANCE COVERAGE!!Civilian noninstitutionalized population!!No health insurance coverage', 'Percent!!HEALTH INSURANCE COVERAGE!!Civilian noninstitutionalized population!!With health insurance coverage!!With public coverage'] },
    'Health': { name: 'Health & Disability', vars: ['Percent!!DISABILITY STATUS OF THE CIVILIAN NONINSTITUTIONALIZED POPULATION!!Total Civilian Noninstitutionalized Population!!With a disability'] },
    'Family': { name: 'Family & Household Structure', vars: ['Percent!!HOUSEHOLDS BY TYPE!!Total households!!Married-couple household!!With children of the householder under 18 years', 'Percent!!HOUSEHOLDS BY TYPE!!Total households!!Households with one or more people 65 years and over', 'Percent!!HOUSEHOLDS BY TYPE!!Total households!!Male householder, no spouse/partner present!!Householder living alone'] },
    'Mobility': { name: 'Residential Mobility', vars: ['Percent!!RESIDENCE 1 YEAR AGO!!Population 1 year and over!!Same house', 'Percent!!RESIDENCE 1 YEAR AGO!!Population 1 year and over!!Different house (in the U.S. or abroad)'] },
    'Assistance': { name: 'Public Assistance', vars: ['Percent!!INCOME AND BENEFITS (IN 2022 INFLATION-ADJUSTED DOLLARS)!!Total households!!With Food Stamp/SNAP benefits in the past 12 months'] },
    'Poverty': { name: 'Poverty Status', vars: ['Percent!!PERCENTAGE OF FAMILIES AND PEOPLE WHOSE INCOME IN THE PAST 12 MONTHS IS BELOW THE POVERTY LEVEL!!All people'] }
};

export const BASE_CENSUS_VARS = ['Percent!!HOUSING TENURE!!Occupied housing units!!Renter-occupied']; // Renter Percentage

// --- METRICS CONFIGURATION ---
export const METRICS_CONFIG = {
    // Housing & Economic Status
    renter: { title: 'Renter Demographics', legendTitle: 'Renter Percentage', var: 'Percent!!HOUSING TENURE!!Occupied housing units!!Renter-occupied', unit: '%', type: 'percent', chunkKey: 'Renter', palette: ['#FFEDA0','#FC4E2A','#E31A1C','#BD0026','#800026'] },
    poverty: { title: 'Poverty Demographics', legendTitle: 'Poverty Level (%)', var: 'Percent!!PERCENTAGE OF FAMILIES AND PEOPLE WHOSE INCOME IN THE PAST 12 MONTHS IS BELOW THE POVERTY LEVEL!!All people', unit: '%', type: 'percent', chunkKey: 'Poverty', palette: ['#FFEDA0','#FC4E2A','#E31A1C','#BD0026','#800026'] },
    income: { title: 'Household Income', legendTitle: 'Median Income ($)', var: 'Estimate!!INCOME AND BENEFITS (IN 2022 INFLATION-ADJUSTED DOLLARS)!!Total households!!Median household income (dollars)', unit: '$', type: 'currency', chunkKey: 'Income', palette: ['#FFFFCC','#C2E699','#78C679','#31A354','#006837'] },
    per_capita_income: { title: 'Per Capita Income', legendTitle: 'Per Capita Income ($)', var: 'Estimate!!INCOME AND BENEFITS (IN 2022 INFLATION-ADJUSTED DOLLARS)!!Per capita income (dollars)', unit: '$', type: 'currency', chunkKey: 'Income', palette: ['#FFFFCC','#C2E699','#78C679','#31A354','#006837'] },
    high_income: { title: 'High Income Households', legendTitle: 'Income $100k+ (%)', var: 'Percent!!INCOME AND BENEFITS (IN 2022 INFLATION-ADJUSTED DOLLARS)!!Total households!!$100,000 to $149,999', unit: '%', type: 'percent', chunkKey: 'Income', palette: ['#F7FCF5','#C7E9C0','#74C476','#31A354','#006D2C'] },

    // Employment & Work
    unemployment: { title: 'Unemployment Rate', legendTitle: 'Unemployment Rate (%)', var: 'Percent!!EMPLOYMENT STATUS!!Civilian labor force!!Unemployment Rate', unit: '%', type: 'percent', chunkKey: 'Employment', palette: ['#FFF5EB','#FDBE85','#FD8D3C','#E6550D','#A63603'] },
    self_employed: { title: 'Self-Employed Workers', legendTitle: 'Self-Employed (%)', var: 'Percent!!CLASS OF WORKER!!Civilian employed population 16 years and over!!Self-employed in own not incorporated business workers', unit: '%', type: 'percent', chunkKey: 'Employment', palette: ['#F7F7F7','#CCCCCC','#969696','#636363','#252525'] },
    government_workers: { title: 'Government Workers', legendTitle: 'Government Workers (%)', var: 'Percent!!CLASS OF WORKER!!Civilian employed population 16 years and over!!Government workers', unit: '%', type: 'percent', chunkKey: 'Employment', palette: ['#EDF8FB','#B2E2E2','#66C2A4','#2CA25F','#006D2C'] },
    professional_jobs: { title: 'Professional/Management Jobs', legendTitle: 'Professional Jobs (%)', var: 'Percent!!INDUSTRY!!Civilian employed population 16 years and over!!Professional, scientific, and management, and administrative and waste management services', unit: '%', type: 'percent', chunkKey: 'Employment', palette: ['#F7FCF5','#C7E9C0','#74C476','#238B45','#005A32'] },
    work_from_home: { title: 'Work from Home', legendTitle: 'Work from Home (%)', var: 'Percent!!COMMUTING TO WORK!!Workers 16 years and over!!Worked from home', unit: '%', type: 'percent', chunkKey: 'Employment', palette: ['#FFF5F0','#FDD0A2','#FD8D3C','#D94801','#8C2D04'] },

    // Education
    bachelors_plus: { title: 'Higher Education', legendTitle: "Bachelor's Degree+ (%)", var: "Percent!!EDUCATIONAL ATTAINMENT!!Population 25 years and over!!Bachelor's degree or higher", unit: '%', type: 'percent', chunkKey: 'Education', palette: ['#F7FCF5','#C7E9C0','#74C476','#238B45','#005A32'] },
    graduate_degree: { title: 'Graduate/Professional Degree', legendTitle: 'Graduate Degree (%)', var: 'Percent!!EDUCATIONAL ATTAINMENT!!Population 25 years and over!!Graduate or professional degree', unit: '%', type: 'percent', chunkKey: 'Education', palette: ['#F7FCF5','#C7E9C0','#74C476','#238B45','#005A32'] },
    high_school_plus: { title: 'High School Education', legendTitle: 'High School+ (%)', var: 'Percent!!EDUCATIONAL ATTAINMENT!!Population 25 years and over!!High school graduate or higher', unit: '%', type: 'percent', chunkKey: 'Education', palette: ['#FFF5F0','#FDD0A2','#FD8D3C','#D94801','#8C2D04'] },

    // Demographics & Diversity
    foreign_born: { title: 'Foreign-Born Population', legendTitle: 'Foreign-Born (%)', var: 'Percent!!PLACE OF BIRTH!!Total population!!Foreign born', unit: '%', type: 'percent', chunkKey: 'Demographics', palette: ['#F7F4F9','#D4B9DA','#C994C7','#DF65B0','#DD1C77'] },
    non_english: { title: 'Non-English Speaking', legendTitle: 'Language Other Than English (%)', var: 'Percent!!LANGUAGE SPOKEN AT HOME!!Population 5 years and over!!Language other than English', unit: '%', type: 'percent', chunkKey: 'Demographics', palette: ['#F7F4F9','#D4B9DA','#C994C7','#DF65B0','#DD1C77'] },
    spanish_speaking: { title: 'Spanish Speaking', legendTitle: 'Spanish Speaking (%)', var: 'Percent!!LANGUAGE SPOKEN AT HOME!!Population 5 years and over!!Spanish', unit: '%', type: 'percent', chunkKey: 'Demographics', palette: ['#FFFFE5','#F7FCB9','#D9F0A3','#ADDD8E','#78C679'] },

    // Health & Vulnerability
    uninsured: { title: 'No Health Insurance', legendTitle: 'Uninsured (%)', var: 'Percent!!HEALTH INSURANCE COVERAGE!!Civilian noninstitutionalized population!!No health insurance coverage', unit: '%', type: 'percent', chunkKey: 'HealthInsurance', palette: ['#F1EEF6','#BDC9E1','#74A9CF','#2B8CBE','#045A8D'] },
    public_insurance: { title: 'Public Health Insurance', legendTitle: 'Public Insurance (%)', var: 'Percent!!HEALTH INSURANCE COVERAGE!!Civilian noninstitutionalized population!!With health insurance coverage!!With public coverage', unit: '%', type: 'percent', chunkKey: 'HealthInsurance', palette: ['#FFF5F0','#FDD0A2','#FD8D3C','#D94801','#8C2D04'] },
    disability: { title: 'Population with Disabilities', legendTitle: 'Disability Rate (%)', var: 'Percent!!DISABILITY STATUS OF THE CIVILIAN NONINSTITUTIONALIZED POPULATION!!Total Civilian Noninstitutionalized Population!!With a disability', unit: '%', type: 'percent', chunkKey: 'Health', palette: ['#F7F7F7','#CCCCCC','#969696','#636363','#252525'] },
    food_stamps: { title: 'Food Assistance (SNAP)', legendTitle: 'SNAP Benefits (%)', var: 'Percent!!INCOME AND BENEFITS (IN 2022 INFLATION-ADJUSTED DOLLARS)!!Total households!!With Food Stamp/SNAP benefits in the past 12 months', unit: '%', type: 'percent', chunkKey: 'Assistance', palette: ['#FFEDA0','#FC4E2A','#E31A1C','#BD0026','#800026'] },

    // Housing & Mobility
    households_children: { title: 'Families with Children', legendTitle: 'Married Couples with Children <18 (%)', var: 'Percent!!HOUSEHOLDS BY TYPE!!Total households!!Married-couple household!!With children of the householder under 18 years', unit: '%', type: 'percent', chunkKey: 'Family', palette: ['#F7FCF5','#C7E9C0','#74C476','#238B45','#005A32'] },
    households_seniors: { title: 'Households with Seniors', legendTitle: 'Households with 65+ (%)', var: 'Percent!!HOUSEHOLDS BY TYPE!!Total households!!Households with one or more people 65 years and over', unit: '%', type: 'percent', chunkKey: 'Family', palette: ['#F7F4F9','#D4B9DA','#C994C7','#DF65B0','#DD1C77'] },
    single_person: { title: 'Single-Person Households', legendTitle: 'Living Alone (Male) (%)', var: 'Percent!!HOUSEHOLDS BY TYPE!!Total households!!Male householder, no spouse/partner present!!Householder living alone', unit: '%', type: 'percent', chunkKey: 'Family', palette: ['#F7F7F7','#CCCCCC','#969696','#636363','#252525'] },
    housing_stability: { title: 'Housing Stability', legendTitle: 'Same House 1 Year Ago (%)', var: 'Percent!!RESIDENCE 1 YEAR AGO!!Population 1 year and over!!Same house', unit: '%', type: 'percent', chunkKey: 'Mobility', palette: ['#F7FCF5','#C7E9C0','#74C476','#238B45','#005A32'] },
    residential_mobility: { title: 'Residential Mobility', legendTitle: 'Moved in Past Year (%)', var: 'Percent!!RESIDENCE 1 YEAR AGO!!Population 1 year and over!!Different house (in the U.S. or abroad)', unit: '%', type: 'percent', chunkKey: 'Mobility', palette: ['#FFF5F0','#FDD0A2','#FD8D3C','#D94801','#8C2D04'] },

    // Transportation
    commute_drive_alone: { title: 'Drive Alone to Work', legendTitle: 'Drive Alone (%)', var: 'Percent!!COMMUTING TO WORK!!Workers 16 years and over!!Car, truck, or van -- drove alone', unit: '%', type: 'percent', chunkKey: 'Commuting', palette: ['#FEE5D9','#FCAE91','#FB6A4A','#DE2D26','#A50F15'] },
    public_transit: { title: 'Public Transportation', legendTitle: 'Public Transit (%)', var: 'Percent!!COMMUTING TO WORK!!Workers 16 years and over!!Public transportation (excluding taxicab)', unit: '%', type: 'percent', chunkKey: 'Commuting', palette: ['#EFF3FF','#BDD7E7','#6BAED6','#3182BD','#08519C'] },
    commute_time: { title: 'Mean Travel Time', legendTitle: 'Mean Travel Time (min)', var: 'Estimate!!COMMUTING TO WORK!!Workers 16 years and over!!Mean travel time to work (minutes)', unit: ' min', type: 'number', chunkKey: 'Commuting', palette: ['#EFF3FF','#BDD7E7','#6BAED6','#3182BD','#08519C'] }
};

// Cache configuration
export const CACHE_DURATION = 10 * 7 * 24 * 60 * 60 * 1000; // 10 weeks in milliseconds
