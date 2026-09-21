from backend.app.core.integrity import verify_file_integrity


original_file = "test_data/original/evidence.png"
recovered_file = "test_data/recovered/recovered_png_1.png"


result = verify_file_integrity(
    original_file,
    recovered_file
)


print()
print("========================================")

if result:
    print("VERIFICATION : PASSED")
else:
    print("VERIFICATION : FAILED")

print("========================================")