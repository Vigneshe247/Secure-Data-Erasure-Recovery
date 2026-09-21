from pathlib import Path


class StorageAnalyzer:

    def __init__(
        self,
        image_path,
        sector_size=512,
        region_size=1024 * 1024
    ):
        self.image_path = Path(image_path)
        self.sector_size = sector_size
        self.region_size = region_size

    def analyze(self):

        if not self.image_path.exists():
            raise FileNotFoundError(
                f"Storage image not found: {self.image_path}"
            )

        size = self.image_path.stat().st_size

        total_sectors = size // self.sector_size

        number_of_regions = (
            size + self.region_size - 1
        ) // self.region_size

        return {
            "image": str(self.image_path),
            "size_bytes": size,
            "sector_size": self.sector_size,
            "total_sectors": total_sectors,
            "region_size_bytes": self.region_size,
            "number_of_scan_regions": number_of_regions
        }


if __name__ == "__main__":

    analyzer = StorageAnalyzer(
        "test_data/demo_disk.img"
    )

    result = analyzer.analyze()

    print("\n=== STORAGE ANALYSIS ===")

    for key, value in result.items():
        print(f"{key}: {value}")