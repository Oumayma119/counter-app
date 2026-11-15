import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { PublicHoliday } from '../models/public-holiday';
import { isCalendarDate } from '../models/holiday-date';

export interface Country {
  isoCode: string;
  name: { language: string; text: string }[];
}

export interface SchoolHoliday {
  id: string;
  startDate: string;
  endDate: string;
  name: { language: string; text: string }[];
  subdivisions?: { code: string; shortName: string }[];
}

function isHolidayName(value: unknown): value is PublicHoliday['name'][number] {
  return typeof value === 'object' && value !== null &&
    'language' in value && typeof (value as any).language === 'string' &&
    'text' in value && typeof (value as any).text === 'string';
}

function isPublicHoliday(value: unknown): value is PublicHoliday {
  return typeof value === 'object' && value !== null &&
    'id' in value && typeof (value as any).id === 'string' &&
    'startDate' in value && isCalendarDate((value as any).startDate) &&
    'endDate' in value && isCalendarDate((value as any).endDate) &&
    'name' in value && Array.isArray((value as any).name) &&
    (value as any).name.length > 0 && (value as any).name.every(isHolidayName);
}

@Injectable({
  providedIn: 'root',
})
export class HolidayApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'https://openholidaysapi.org';

  async getCountries(): Promise<Country[]> {
    const response = await firstValueFrom(
      this.http.get<Country[]>(`${this.baseUrl}/Countries`).pipe(timeout(10000)),
    );
    return response.sort((a, b) => {
      const nameA = a.name.find((n) => n.language === 'CS')?.text ?? a.isoCode;
      const nameB = b.name.find((n) => n.language === 'CS')?.text ?? b.isoCode;
      return nameA.localeCompare(nameB);
    });
  }

  async getHolidays(countryIsoCode: string, validFrom: string, validTo: string): Promise<PublicHoliday[]> {
    const response = await firstValueFrom(
      this.http.get<unknown>(`${this.baseUrl}/PublicHolidays`, {
        params: {
          countryIsoCode,
          languageIsoCode: countryIsoCode === 'CZ' ? 'CS' : 'EN',
          validFrom,
          validTo,
        },
      }).pipe(timeout(10000)),
    );

    if (!Array.isArray(response) || !response.every(isPublicHoliday)) {
      throw new Error('API vrátilo svátky v neočekávaném formátu.');
    }

    return response.sort((a, b) => a.startDate.localeCompare(b.startDate));
  }

  async getSchoolHolidays(countryIsoCode: string, validFrom: string, validTo: string): Promise<SchoolHoliday[]> {
    const response = await firstValueFrom(
      this.http.get<SchoolHoliday[]>(`${this.baseUrl}/SchoolHolidays`, {
        params: {
          countryIsoCode,
          languageIsoCode: countryIsoCode === 'CZ' ? 'CS' : 'EN',
          validFrom,
          validTo,
        },
      }).pipe(timeout(10000)),
    );

    return response.sort((a, b) => a.startDate.localeCompare(b.startDate));
  }
}