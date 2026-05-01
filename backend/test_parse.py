import csv
import io

content = "G0327-\tBEVLE-ZS-大型路口-越-0403\t123\tmanhhung\t\t\t50\t\t\t"
delimiter = ','
if '\t' in content.split('\n')[0]:
    delimiter = '\t'
stream = io.StringIO(content, newline=None)
reader = csv.reader(stream, delimiter=delimiter)
for row in reader:
    print(row)
