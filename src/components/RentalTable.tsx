import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { RentalListing } from "@/data/mockData";

const fmt = (n: number) =>
  n.toLocaleString("en-SG", { style: "currency", currency: "SGD", maximumFractionDigits: 0 });

const RentalTable = ({ data }: { data: RentalListing[] }) => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Project</TableHead>
        <TableHead>Type</TableHead>
        <TableHead className="text-right">Area</TableHead>
        <TableHead className="text-right">Rent/mth</TableHead>
        <TableHead className="text-right">$/psf</TableHead>
        <TableHead>Date</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {data.map((r, i) => (
        <TableRow key={i}>
          <TableCell className="font-medium">{r.project}</TableCell>
          <TableCell>{r.unitType}</TableCell>
          <TableCell className="text-right">{r.areaSqft} sqft</TableCell>
          <TableCell className="text-right">{fmt(r.rent)}</TableCell>
          <TableCell className="text-right">${r.rentPsf.toFixed(2)}</TableCell>
          <TableCell>{r.date}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

export default RentalTable;
