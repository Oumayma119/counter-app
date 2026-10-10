import { Component, inject, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AlertController,
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSearchbar,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular';
import { CounterService } from '../services/counter.service';
import { SavedCounter } from '../models/saved-counter';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  imports: [
    DatePipe,
    FormsModule,
    IonButton,
    IonCard,
    IonCardContent,
    IonContent,
    IonHeader,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonSearchbar,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    IonTitle,
    IonToolbar,
  ],
})
export class Tab2Page implements OnInit {
  readonly counterService = inject(CounterService);
  private readonly alertController = inject(AlertController);
  private readonly toastController = inject(ToastController);

  searchQuery = '';
  sortBy: 'newest' | 'name' | 'value' = 'newest';

  valueFilter: 'all' | 'positive' | 'negative' = 'all';   

  async ngOnInit(): Promise<void> {
    await this.counterService.initialize();
  }

  get filteredCounters(): SavedCounter[] {
    let list = [...this.counterService.counters()];

    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase().trim();
      list = list.filter((c) => c.name.toLowerCase().includes(query));
    }

    if (this.valueFilter === 'positive') {
      list = list.filter((c) => c.value > 0);
    } else if (this.valueFilter === 'negative') {
      list = list.filter((c) => c.value < 0);
    }

    if (this.sortBy === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (this.sortBy === 'value') {
      list.sort((a, b) => b.value - a.value); 
    } else {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return list;
  }

  get totalSum(): number {
    return this.filteredCounters.reduce((sum, c) => sum + c.value, 0);
  }

  async remove(id: string): Promise<void> {
    await this.counterService.remove(id);
    await this.showToast('Záznam byl odstraněn', 'danger');
  }

  async confirmClear(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Vymazat historii',
      message: 'Opravdu chcete smazat celou historii počítadel? Tato akce je nevratná.',
      buttons: [
        {
          text: 'Zrušit',
          role: 'cancel',
        },
        {
          text: 'Vymazat vše',
          role: 'destructive',
          handler: async () => {
            await this.counterService.clear();
            await this.showToast('Celá historie byla vymazána', 'danger');
          },
        },
      ],
    });
    await alert.present();
  }

  private async showToast(message: string, color: 'success' | 'danger' = 'success'): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      position: 'bottom',
      color,
    });
    await toast.present();
  }
}