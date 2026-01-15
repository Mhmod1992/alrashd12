import React from 'react';
import Icon from './Icon';

interface ImageItem {
    id: string;
    imageUrl: string;
    text: string;
    categoryName: string;
    authorName: string;
}

interface ImageGalleryProps {
    images: ImageItem[];
    onImageClick: (imageUrl: string) => void;
}

const ImageGallery: React.FC<ImageGalleryProps> = ({ images, onImageClick }) => {
    if (images.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-center text-gray-500 dark:text-gray-400">
                <Icon name="camera" className="w-16 h-16 mb-4" />
                <h3 className="text-xl font-semibold">لا توجد صور</h3>
                <p className="mt-2">لم يتم إرفاق أي صور مع الملاحظات في هذا الطلب بعد.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 animate-fade-in">
            {images.map(image => (
                <div 
                    key={image.id}
                    className="group rounded-lg overflow-hidden shadow-lg bg-white dark:bg-slate-700 flex flex-col"
                >
                    <div 
                        className="relative cursor-pointer aspect-square bg-gray-200 dark:bg-slate-600 overflow-hidden"
                        onClick={() => onImageClick(image.imageUrl)}
                    >
                        <img 
                            src={image.imageUrl} 
                            alt={image.text || 'صورة ملاحظة'}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                        />
                    </div>
                    <div className="p-3 text-xs">
                        <p className="font-bold text-teal-600 dark:text-teal-400 line-clamp-1">{image.categoryName}</p>
                        <p className="text-gray-700 dark:text-gray-300 mt-1 line-clamp-2 h-8">{image.text || 'لا يوجد نص للملاحظة'}</p>
                        <p className="text-gray-500 dark:text-gray-400 mt-2 text-[10px]">أضافها: {image.authorName}</p>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ImageGallery;